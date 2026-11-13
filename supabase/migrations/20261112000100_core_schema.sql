-- Milestone 1: core data model for the internal report testing app.
-- Brief: docs/build/internal-testing-app.md §5 (data model) and §7 (integrity rules).
--
-- Access model: only users listed in public.admin_user may read or write any row.
-- Evidence tables are append-only and enforced here, in the database, not in app code.

-- ---------------------------------------------------------------------------
-- Admin users and the access check used by every policy
-- ---------------------------------------------------------------------------

create table public.admin_user (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  note       text,
  created_at timestamptz not null default now()
);
comment on table public.admin_user is
  'Auth users allowed into the app. Insert rows from the Supabase SQL editor; there is no sign-up.';

-- SECURITY DEFINER so policies can consult admin_user without recursing through its own RLS.
create function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.admin_user a where a.user_id = (select auth.uid()));
$$;
revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Shared trigger functions
-- ---------------------------------------------------------------------------

create function public.tg_set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Rejects every UPDATE and DELETE. Attached to evidence tables that must never change.
create function public.tg_append_only()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception '% is append-only: % is not allowed', tg_table_name, tg_op
    using errcode = 'P0001', hint = 'Insert a new row instead; earlier rows are kept as evidence.';
end;
$$;

-- ---------------------------------------------------------------------------
-- Pricing (versioned). Cost estimates reference the exact row used.
-- ---------------------------------------------------------------------------

create table public.pricing (
  id                     bigint generated always as identity primary key,
  provider               text not null,
  model                  text not null,
  version                integer not null check (version > 0),
  input_usd_per_mtok     numeric(12, 6) not null default 0 check (input_usd_per_mtok >= 0),
  output_usd_per_mtok    numeric(12, 6) not null default 0 check (output_usd_per_mtok >= 0),
  search_usd_per_call    numeric(12, 6) not null default 0 check (search_usd_per_call >= 0),
  request_usd_per_call   numeric(12, 6) not null default 0 check (request_usd_per_call >= 0),
  effective_from         timestamptz not null default now(),
  source                 text not null,
  created_at             timestamptz not null default now(),
  unique (provider, model, version)
);
comment on table public.pricing is
  'Price list used for cost estimates. Never edited: a price change is a new row with version + 1.';
create trigger pricing_append_only before update or delete on public.pricing
  for each row execute function public.tg_append_only();

-- ---------------------------------------------------------------------------
-- Business and report
-- ---------------------------------------------------------------------------

create table public.business (
  id             uuid primary key default gen_random_uuid(),
  name           text not null check (length(btrim(name)) > 0),
  aliases        text[] not null default '{}',
  website        text,
  domains        text[] not null default '{}',
  category       text not null check (length(btrim(category)) > 0),
  location       text not null check (length(btrim(location)) > 0),
  service_area   text,
  services       text[] not null default '{}',
  customer_types text[] not null default '{}',
  place_id       text,
  created_by     uuid references auth.users (id) on delete set null default auth.uid(),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create trigger business_updated_at before update on public.business
  for each row execute function public.tg_set_updated_at();

create table public.report (
  id                uuid primary key default gen_random_uuid(),
  business_id       uuid not null references public.business (id) on delete restrict,
  version           integer not null default 1 check (version > 0),
  status            text not null default 'draft'
                    check (status in ('draft', 'queued', 'running', 'done', 'failed', 'partial')),
  spending_cap_usd  numeric(12, 4) not null default 5 check (spending_cap_usd >= 0),
  created_by        uuid references auth.users (id) on delete set null default auth.uid(),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (business_id, version)
);
comment on column public.report.spending_cap_usd is
  'Hard cap on estimated paid-call cost for this report. Checked before every paid call.';
create index report_business_idx on public.report (business_id);
create trigger report_updated_at before update on public.report
  for each row execute function public.tg_set_updated_at();

-- ---------------------------------------------------------------------------
-- Prompt sets (versioned; frozen once approved)
-- ---------------------------------------------------------------------------

create table public.prompt_set (
  id          uuid primary key default gen_random_uuid(),
  report_id   uuid not null references public.report (id) on delete restrict,
  version     integer not null check (version > 0),
  -- [{ "id": "p1", "text": "...", "group": "...", "order": 1 }, ...]
  prompts     jsonb not null default '[]' check (jsonb_typeof(prompts) = 'array'),
  approved_by uuid references auth.users (id) on delete set null,
  approved_at timestamptz,
  created_by  uuid references auth.users (id) on delete set null default auth.uid(),
  created_at  timestamptz not null default now(),
  unique (report_id, version),
  check ((approved_by is null) = (approved_at is null))
);

create function public.tg_prompt_set_frozen_when_approved()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    if old.approved_at is not null then
      raise exception 'prompt_set % is approved and cannot be deleted', old.id using errcode = 'P0001';
    end if;
    return old;
  end if;
  if old.approved_at is not null then
    raise exception 'prompt_set % is approved and frozen; create a new version', old.id using errcode = 'P0001';
  end if;
  if new.id <> old.id or new.report_id <> old.report_id or new.version <> old.version then
    raise exception 'prompt_set identity columns cannot change' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
create trigger prompt_set_frozen before update or delete on public.prompt_set
  for each row execute function public.tg_prompt_set_frozen_when_approved();

-- ---------------------------------------------------------------------------
-- Stage runs (job queue rows). Reruns are new rows; finished rows are frozen.
-- ---------------------------------------------------------------------------

create table public.stage_run (
  id               uuid primary key default gen_random_uuid(),
  report_id        uuid not null references public.report (id) on delete restrict,
  stage            text not null,
  version          integer not null check (version > 0),
  params           jsonb not null default '{}',
  inputs_hash      text not null,
  input_run_ids    uuid[] not null default '{}',
  status           text not null default 'queued'
                   check (status in ('queued', 'running', 'done', 'failed', 'partial')),
  attempt          integer not null default 0 check (attempt >= 0),
  max_attempts     integer not null default 3 check (max_attempts > 0),
  timeout_ms       integer not null default 60000 check (timeout_ms > 0),
  run_after        timestamptz not null default now(),
  locked_until     timestamptz,
  started_at       timestamptz,
  finished_at      timestamptz,
  error            text,
  output           jsonb,
  output_hash      text,
  tokens_in        bigint not null default 0 check (tokens_in >= 0),
  tokens_out       bigint not null default 0 check (tokens_out >= 0),
  search_calls     integer not null default 0 check (search_calls >= 0),
  cost_usd         numeric(12, 6) not null default 0 check (cost_usd >= 0),
  duration_ms      bigint check (duration_ms >= 0),
  pricing_ids      bigint[] not null default '{}',
  created_by       uuid references auth.users (id) on delete set null default auth.uid(),
  created_at       timestamptz not null default now(),
  unique (report_id, stage, version),
  check ((finished_at is null) = (status in ('queued', 'running')))
);
comment on table public.stage_run is
  'One execution of one pipeline stage for one report. Reruns insert a new version; finished rows never change.';
comment on column public.stage_run.pricing_ids is 'pricing rows used for this run''s cost estimate';
create index stage_run_report_stage_idx on public.stage_run (report_id, stage, version desc);
create index stage_run_claimable_idx on public.stage_run (run_after) where status = 'queued';

-- While a run is unfinished, only status, scheduling, error and usage fields may change.
-- Once finished_at is set the row is frozen. Deletes are never allowed.
create function public.tg_stage_run_guard()
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
      new.max_attempts, new.timeout_ms, new.created_by, new.created_at)
     is distinct from
     (old.id, old.report_id, old.stage, old.version, old.params, old.inputs_hash, old.input_run_ids,
      old.max_attempts, old.timeout_ms, old.created_by, old.created_at) then
    raise exception 'stage_run identity and input columns cannot change' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
create trigger stage_run_guard before update or delete on public.stage_run
  for each row execute function public.tg_stage_run_guard();

-- Stale marks: a rerun of an upstream stage marks downstream runs stale without touching
-- the frozen stage_run rows. The admin decides whether to rerun them.
create table public.stage_run_stale (
  id               bigint generated always as identity primary key,
  stage_run_id     uuid not null references public.stage_run (id) on delete restrict,
  caused_by_run_id uuid not null references public.stage_run (id) on delete restrict,
  marked_at        timestamptz not null default now(),
  unique (stage_run_id, caused_by_run_id)
);
create trigger stage_run_stale_append_only before update or delete on public.stage_run_stale
  for each row execute function public.tg_append_only();

-- Every paid call (AI tokens, search calls, priced API requests), with the pricing row used.
create table public.usage_event (
  id            bigint generated always as identity primary key,
  stage_run_id  uuid not null references public.stage_run (id) on delete restrict,
  attempt       integer not null check (attempt > 0),
  provider      text not null,
  model         text not null,
  pricing_id    bigint not null references public.pricing (id) on delete restrict,
  tokens_in     bigint not null default 0 check (tokens_in >= 0),
  tokens_out    bigint not null default 0 check (tokens_out >= 0),
  search_calls  integer not null default 0 check (search_calls >= 0),
  requests      integer not null default 1 check (requests >= 0),
  cost_usd      numeric(12, 6) not null check (cost_usd >= 0),
  duration_ms   bigint not null check (duration_ms >= 0),
  succeeded     boolean not null,
  error         text,
  created_at    timestamptz not null default now()
);
create index usage_event_stage_run_idx on public.usage_event (stage_run_id);
create trigger usage_event_append_only before update or delete on public.usage_event
  for each row execute function public.tg_append_only();

-- ---------------------------------------------------------------------------
-- Evidence (append-only)
-- ---------------------------------------------------------------------------

create table public.engine_answer (
  id            uuid primary key default gen_random_uuid(),
  report_id     uuid not null references public.report (id) on delete restrict,
  prompt_set_id uuid not null references public.prompt_set (id) on delete restrict,
  prompt_id     text not null,
  prompt_text   text not null,
  engine        text not null check (engine in ('chatgpt', 'claude', 'gemini')),
  model         text not null,
  request_id    text,
  settings      jsonb not null default '{}',
  raw_response  jsonb,
  answer_text   text,
  -- [{ "original_url": "...", "resolved_url": "...", "title": "..." }]
  citations     jsonb not null default '[]' check (jsonb_typeof(citations) = 'array'),
  status        text not null check (status in ('ok', 'error', 'refused', 'unavailable')),
  error         text,
  requested_at  timestamptz not null,
  responded_at  timestamptz,
  stage_run_id  uuid references public.stage_run (id) on delete restrict,
  created_at    timestamptz not null default now()
);
comment on table public.engine_answer is
  'Original AI engine answers. One slot per (prompt_set, prompt_id, engine); retries add rows, latest fills the slot.';
create index engine_answer_slot_idx on public.engine_answer (prompt_set_id, prompt_id, engine, created_at desc);
create trigger engine_answer_append_only before update or delete on public.engine_answer
  for each row execute function public.tg_append_only();

create table public.page_snapshot (
  id            uuid primary key default gen_random_uuid(),
  report_id     uuid references public.report (id) on delete restrict,
  url           text not null,
  final_url     text,
  fetch_mode    text not null check (fetch_mode in ('raw', 'rendered', 'engine_tool')),
  engine        text check (engine in ('chatgpt', 'claude', 'gemini')),
  user_agent    text,
  http_status   integer,
  content_hash  text,
  text_hash     text,
  storage_path  text,
  error         text,
  fetched_at    timestamptz not null,
  stage_run_id  uuid references public.stage_run (id) on delete restrict,
  created_at    timestamptz not null default now(),
  check ((fetch_mode = 'engine_tool') = (engine is not null))
);
create index page_snapshot_report_idx on public.page_snapshot (report_id, url);
create trigger page_snapshot_append_only before update or delete on public.page_snapshot
  for each row execute function public.tg_append_only();

create table public.listing_snapshot (
  id            uuid primary key default gen_random_uuid(),
  report_id     uuid references public.report (id) on delete restrict,
  business_id   uuid references public.business (id) on delete restrict,
  source        text not null,
  source_ref    text,
  raw_payload   jsonb,
  -- provider storage terms, e.g. { "refetch_per_report": true, "max_cache_days": 30 }
  terms_flags   jsonb not null default '{}',
  fetched_at    timestamptz not null,
  stage_run_id  uuid references public.stage_run (id) on delete restrict,
  created_at    timestamptz not null default now()
);
create index listing_snapshot_report_idx on public.listing_snapshot (report_id, source);
create trigger listing_snapshot_append_only before update or delete on public.listing_snapshot
  for each row execute function public.tg_append_only();

-- ---------------------------------------------------------------------------
-- Findings and reviews
-- ---------------------------------------------------------------------------

create table public.finding (
  id                uuid primary key default gen_random_uuid(),
  report_id         uuid not null references public.report (id) on delete restrict,
  section           text not null,
  claim             text not null,
  value             jsonb,
  provenance        text not null check (provenance in ('observed', 'assumed', 'sample', 'missing')),
  -- [{ "kind": "engine_answer" | "page_snapshot" | "listing_snapshot", "id": "...", "span": "..." }]
  evidence          jsonb not null default '[]' check (jsonb_typeof(evidence) = 'array'),
  assumption_rule   text,
  missing_reason    text,
  confidence        numeric(4, 3) check (confidence between 0 and 1),
  stage_run_id      uuid references public.stage_run (id) on delete restrict,
  created_at        timestamptz not null default now(),
  -- Integrity rules (brief §3.8): observed needs evidence, assumed needs its rule, missing needs a reason.
  check (provenance <> 'observed' or jsonb_array_length(evidence) > 0),
  check (provenance <> 'assumed' or length(btrim(coalesce(assumption_rule, ''))) > 0),
  check (provenance <> 'missing' or length(btrim(coalesce(missing_reason, ''))) > 0)
);
create index finding_report_section_idx on public.finding (report_id, section);
create trigger finding_append_only before update or delete on public.finding
  for each row execute function public.tg_append_only();

create table public.finding_review (
  id          uuid primary key default gen_random_uuid(),
  finding_id  uuid not null references public.finding (id) on delete restrict,
  reviewer    uuid references auth.users (id) on delete set null default auth.uid(),
  verdict     text not null check (verdict in ('correct', 'wrong', 'incomplete', 'unsure')),
  correction  text,
  note        text,
  reviewed_at timestamptz not null default now()
);
create index finding_review_finding_idx on public.finding_review (finding_id, reviewed_at desc);
create trigger finding_review_append_only before update or delete on public.finding_review
  for each row execute function public.tg_append_only();

-- ---------------------------------------------------------------------------
-- Row level security: admins only, on every table
-- ---------------------------------------------------------------------------

do $$
declare
  t text;
begin
  foreach t in array array[
    'admin_user', 'pricing', 'business', 'report', 'prompt_set', 'stage_run', 'stage_run_stale',
    'usage_event', 'engine_answer', 'page_snapshot', 'listing_snapshot', 'finding', 'finding_review'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon', t);
    execute format(
      'create policy admin_all on public.%I for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()))',
      t
    );
  end loop;
end;
$$;

-- admin_user is managed from the SQL editor only: admins may read it, nobody writes it through the API.
drop policy admin_all on public.admin_user;
create policy admin_read on public.admin_user for select to authenticated using ((select public.is_admin()));
revoke insert, update, delete, truncate on public.admin_user from authenticated;

-- ---------------------------------------------------------------------------
-- Health check used by /health: proves a live query works and reports the schema version.
-- ---------------------------------------------------------------------------

create function public.health_check()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  latest text;
begin
  if not public.is_admin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  begin
    select max(version) into latest from supabase_migrations.schema_migrations;
  exception when undefined_table then
    latest := null;
  end;
  return jsonb_build_object('db_time', now(), 'latest_migration', latest);
end;
$$;
revoke all on function public.health_check() from public, anon;
grant execute on function public.health_check() to authenticated;
