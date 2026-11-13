-- Milestone 2 groundwork: versioned LLM instructions, a record of every LLM call, and human-verified evaluation cases.
-- Nothing here changes how existing stages run; stages without instructions behave exactly as before.

-- ---------------------------------------------------------------------------------------------------------------
-- Which instruction versions a stage run uses (recorded at enqueue, part of its inputs hash, frozen like its inputs)
-- ---------------------------------------------------------------------------------------------------------------

alter table public.stage_run
  add column instruction_refs jsonb not null default '[]' check (jsonb_typeof(instruction_refs) = 'array');
comment on column public.stage_run.instruction_refs is
  '[{ "id": "module/task", "version": 1, "sha256": "…" }] — exact instruction versions this run uses (texts in llm_instruction).';

create or replace function public.tg_stage_run_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'stage_run rows are never deleted' using errcode = 'P0001';
  end if;
  if old.finished_at is not null then
    raise exception 'stage_run % is finished and frozen; rerun creates a new row', old.id using errcode = 'P0001';
  end if;
  if (new.id, new.report_id, new.stage, new.version, new.params, new.inputs_hash, new.input_run_ids,
      new.max_attempts, new.timeout_ms, new.created_by, new.created_at, new.instruction_refs)
     is distinct from
     (old.id, old.report_id, old.stage, old.version, old.params, old.inputs_hash, old.input_run_ids,
      old.max_attempts, old.timeout_ms, old.created_by, old.created_at, old.instruction_refs) then
    raise exception 'stage_run identity and input columns cannot change' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

-- enqueue gains the instruction versions. The old signature is replaced (same behaviour otherwise).
drop function public.enqueue_stage_run(uuid, text, jsonb, text, uuid[], integer, integer, text[]);

create function public.enqueue_stage_run(
  p_report_id         uuid,
  p_stage             text,
  p_params            jsonb,
  p_inputs_hash       text,
  p_input_run_ids     uuid[],
  p_timeout_ms        integer,
  p_max_attempts      integer,
  p_downstream_stages text[],
  p_instruction_refs  jsonb default '[]'
)
returns public.stage_run
language plpgsql
security invoker
set search_path = ''
as $$
declare
  next_version integer;
  created public.stage_run;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_report_id::text || ':' || p_stage, 0));

  if exists (
    select 1 from public.stage_run
    where report_id = p_report_id and stage = p_stage and status in ('queued', 'running')
  ) then
    raise exception 'stage % already has a queued or running run for this report', p_stage using errcode = 'P0001';
  end if;

  select coalesce(max(version), 0) + 1 into next_version
  from public.stage_run where report_id = p_report_id and stage = p_stage;

  insert into public.stage_run (report_id, stage, version, params, inputs_hash, input_run_ids, timeout_ms, max_attempts, instruction_refs)
  values (p_report_id, p_stage, next_version, coalesce(p_params, '{}'), p_inputs_hash,
          coalesce(p_input_run_ids, '{}'), p_timeout_ms, p_max_attempts, coalesce(p_instruction_refs, '[]'))
  returning * into created;

  if next_version > 1 and coalesce(array_length(p_downstream_stages, 1), 0) > 0 then
    insert into public.stage_run_stale (stage_run_id, caused_by_run_id)
    select latest.id, created.id
    from (
      select distinct on (stage) id
      from public.stage_run
      where report_id = p_report_id and stage = any (p_downstream_stages)
      order by stage, version desc
    ) latest
    on conflict do nothing;
  end if;

  return created;
end;
$$;
revoke all on function public.enqueue_stage_run(uuid, text, jsonb, text, uuid[], integer, integer, text[], jsonb) from public, anon;
grant execute on function public.enqueue_stage_run(uuid, text, jsonb, text, uuid[], integer, integer, text[], jsonb)
  to authenticated, service_role;

-- The overview selected r.*; recreate it so it includes the new column.
drop view public.stage_run_overview;
create view public.stage_run_overview
with (security_invoker = true)
as
select
  r.*,
  (r.version = max(r.version) over (partition by r.report_id, r.stage)) as is_latest,
  exists (select 1 from public.stage_run_stale st where st.stage_run_id = r.id) as is_stale,
  (select count(*) from public.usage_event u where u.stage_run_id = r.id and not u.succeeded) as failed_calls
from public.stage_run r;

-- ---------------------------------------------------------------------------------------------------------------
-- Instruction texts. Authored in Git (web/src/engine/modules/*/instructions); stored here on first use so a past
-- report can be inspected even after the code has moved on.
-- ---------------------------------------------------------------------------------------------------------------

create table public.llm_instruction (
  instruction_id text not null,
  version        integer not null check (version > 0),
  sha256         text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  body           text not null,
  created_at     timestamptz not null default now(),
  primary key (instruction_id, version)
);
create trigger llm_instruction_append_only before update or delete on public.llm_instruction
  for each row execute function public.tg_append_only();

-- Stores a version once; a different text under the same id and version is refused (the version must be bumped).
create function public.record_llm_instruction(p_id text, p_version integer, p_sha256 text, p_body text)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  stored text;
begin
  insert into public.llm_instruction (instruction_id, version, sha256, body)
  values (p_id, p_version, p_sha256, p_body)
  on conflict (instruction_id, version) do nothing;
  select sha256 into stored from public.llm_instruction where instruction_id = p_id and version = p_version;
  if stored <> p_sha256 then
    raise exception 'instruction % v% already exists with different text; bump its version', p_id, p_version using errcode = 'P0001';
  end if;
end;
$$;
revoke all on function public.record_llm_instruction(text, integer, text, text) from public, anon, authenticated;
grant execute on function public.record_llm_instruction(text, integer, text, text) to service_role;

-- ---------------------------------------------------------------------------------------------------------------
-- Every LLM call made by a stage (interpretation tasks), valid or not, with what was sent and what came back.
-- Model output isn't guaranteed to repeat, so this record — not a re-run — is how a past result is inspected.
-- ---------------------------------------------------------------------------------------------------------------

create table public.llm_call (
  id                  uuid primary key default gen_random_uuid(),
  stage_run_id        uuid not null references public.stage_run (id) on delete restrict,
  attempt             integer not null check (attempt > 0),
  instruction_id      text not null,
  instruction_version integer not null,
  provider            text not null,
  model               text not null,
  served_model        text,
  request_id          text,
  settings            jsonb not null default '{}',
  input               jsonb,
  raw_response        jsonb,
  output              jsonb,
  valid               boolean not null,
  error               text,
  duration_ms         bigint not null check (duration_ms >= 0),
  created_at          timestamptz not null default now(),
  foreign key (instruction_id, instruction_version) references public.llm_instruction (instruction_id, version) on delete restrict,
  check (valid = (output is not null))
);
create index llm_call_stage_run_idx on public.llm_call (stage_run_id, created_at);
create trigger llm_call_append_only before update or delete on public.llm_call
  for each row execute function public.tg_append_only();

-- ---------------------------------------------------------------------------------------------------------------
-- Accuracy evaluation: human-verified expected results for an interpretation task, and how a model+instruction did.
-- Corrections add a new case that supersedes the old one.
-- ---------------------------------------------------------------------------------------------------------------

create table public.eval_case (
  id           uuid primary key default gen_random_uuid(),
  -- The instruction id the case tests, e.g. "prompt-analysis/extract-answer".
  task         text not null,
  -- The exact input given to the task, plus references to the stored evidence it came from.
  input        jsonb not null,
  evidence     jsonb not null default '[]' check (jsonb_typeof(evidence) = 'array'),
  expected     jsonb not null,
  verified_by  uuid not null references auth.users (id) on delete restrict default auth.uid(),
  verified_at  timestamptz not null default now(),
  note         text,
  supersedes   uuid references public.eval_case (id) on delete restrict,
  created_at   timestamptz not null default now()
);
create index eval_case_task_idx on public.eval_case (task);
create trigger eval_case_append_only before update or delete on public.eval_case
  for each row execute function public.tg_append_only();

create table public.eval_result (
  id                  uuid primary key default gen_random_uuid(),
  eval_case_id        uuid not null references public.eval_case (id) on delete restrict,
  instruction_id      text not null,
  instruction_version integer not null,
  provider            text not null,
  model               text not null,
  llm_call_id         uuid references public.llm_call (id) on delete restrict,
  actual              jsonb,
  passed              boolean not null,
  -- Task-specific scoring detail, e.g. { "missed": ["RH"], "extra": [], "statusMismatches": [] }.
  score               jsonb not null default '{}',
  created_at          timestamptz not null default now(),
  foreign key (instruction_id, instruction_version) references public.llm_instruction (instruction_id, version) on delete restrict
);
create index eval_result_case_idx on public.eval_result (eval_case_id, created_at desc);
create trigger eval_result_append_only before update or delete on public.eval_result
  for each row execute function public.tg_append_only();

-- ---------------------------------------------------------------------------------------------------------------
-- RLS: admins only, like every other table
-- ---------------------------------------------------------------------------------------------------------------

do $$
declare
  t text;
begin
  foreach t in array array['llm_instruction', 'llm_call', 'eval_case', 'eval_result'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon', t);
    execute format(
      'create policy admin_all on public.%I for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()))',
      t
    );
  end loop;
end;
$$;
