-- Milestone 1: Postgres-backed job queue for pipeline stages, cost rollups and the fake price used by the dummy stage.
-- The queue is stage_run itself: rows are claimed with FOR UPDATE SKIP LOCKED by the worker (/api/worker/tick).
--
-- Worker functions are SECURITY INVOKER and granted to service_role only: the worker uses the secret key.
-- Admin-facing functions (enqueue) are SECURITY INVOKER, so RLS still applies to the signed-in admin.

-- ---------------------------------------------------------------------------
-- Enqueue: a run or rerun is always a new row with the next version for (report, stage).
-- Downstream stages' latest runs get stale marks; the admin decides whether to rerun them.
-- ---------------------------------------------------------------------------

create function public.enqueue_stage_run(
  p_report_id         uuid,
  p_stage             text,
  p_params            jsonb,
  p_inputs_hash       text,
  p_input_run_ids     uuid[],
  p_timeout_ms        integer,
  p_max_attempts      integer,
  p_downstream_stages text[]
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
  -- Serialize version numbering per (report, stage).
  perform pg_advisory_xact_lock(hashtextextended(p_report_id::text || ':' || p_stage, 0));

  if exists (
    select 1 from public.stage_run
    where report_id = p_report_id and stage = p_stage and status in ('queued', 'running')
  ) then
    raise exception 'stage % already has a queued or running run for this report', p_stage using errcode = 'P0001';
  end if;

  select coalesce(max(version), 0) + 1 into next_version
  from public.stage_run where report_id = p_report_id and stage = p_stage;

  insert into public.stage_run (report_id, stage, version, params, inputs_hash, input_run_ids, timeout_ms, max_attempts)
  values (p_report_id, p_stage, next_version, coalesce(p_params, '{}'), p_inputs_hash,
          coalesce(p_input_run_ids, '{}'), p_timeout_ms, p_max_attempts)
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
revoke all on function public.enqueue_stage_run(uuid, text, jsonb, text, uuid[], integer, integer, text[]) from public, anon;
grant execute on function public.enqueue_stage_run(uuid, text, jsonb, text, uuid[], integer, integer, text[])
  to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Worker: recover expired leases, claim, retry, finish
-- ---------------------------------------------------------------------------

-- Runs whose lease expired (worker crashed or hit the platform time limit) count as a failed attempt.
create function public.recover_expired_stage_runs()
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  n integer;
begin
  with expired as (
    select id from public.stage_run
    where status = 'running' and locked_until < now()
    for update skip locked
  )
  update public.stage_run s set
    status       = case when s.attempt >= s.max_attempts then 'failed' else 'queued' end,
    finished_at  = case when s.attempt >= s.max_attempts then now() else null end,
    duration_ms  = case when s.attempt >= s.max_attempts
                        then (extract(epoch from (now() - s.started_at)) * 1000)::bigint else s.duration_ms end,
    run_after    = now(),
    locked_until = null,
    error        = 'attempt ' || s.attempt || ': lease expired (worker stopped before finishing)'
  from expired
  where s.id = expired.id;
  get diagnostics n = row_count;
  return n;
end;
$$;

-- Claims up to p_limit due runs whose timeout fits in the caller's remaining time budget.
-- attempt is incremented here and doubles as a fencing token for retry/finish.
create function public.claim_stage_runs(p_limit integer, p_max_timeout_ms integer, p_lease_margin_ms integer default 30000)
returns setof public.stage_run
language sql
security invoker
set search_path = ''
as $$
  with candidate as (
    select id from public.stage_run
    where status = 'queued' and run_after <= now() and timeout_ms <= p_max_timeout_ms
    order by run_after, created_at
    for update skip locked
    limit p_limit
  )
  update public.stage_run s set
    status       = 'running',
    attempt      = s.attempt + 1,
    started_at   = coalesce(s.started_at, now()),
    locked_until = now() + make_interval(secs => (s.timeout_ms + p_lease_margin_ms) / 1000.0)
  from candidate
  where s.id = candidate.id
  returning s.*;
$$;

-- Puts a running attempt back in the queue after a retryable failure.
create function public.retry_stage_run(p_id uuid, p_attempt integer, p_error text, p_run_after timestamptz)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  n integer;
begin
  update public.stage_run set
    status = 'queued', run_after = p_run_after, locked_until = null, error = p_error
  where id = p_id and status = 'running' and attempt = p_attempt and attempt < max_attempts;
  get diagnostics n = row_count;
  return n = 1;
end;
$$;

-- Finishes a running attempt (done / partial / failed). Usage totals are rolled up from usage_event
-- so the frozen row always agrees with the per-call records.
create function public.finish_stage_run(
  p_id          uuid,
  p_attempt     integer,
  p_status      text,
  p_output      jsonb,
  p_output_hash text,
  p_error       text
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  n integer;
begin
  if p_status not in ('done', 'partial', 'failed') then
    raise exception 'finish_stage_run: invalid status %', p_status using errcode = 'P0001';
  end if;
  update public.stage_run s set
    status       = p_status,
    output       = p_output,
    output_hash  = p_output_hash,
    error        = p_error,
    finished_at  = now(),
    locked_until = null,
    duration_ms  = (extract(epoch from (now() - s.started_at)) * 1000)::bigint,
    tokens_in    = u.tokens_in,
    tokens_out   = u.tokens_out,
    search_calls = u.search_calls,
    cost_usd     = u.cost_usd,
    pricing_ids  = u.pricing_ids
  from (
    select coalesce(sum(tokens_in), 0)::bigint      as tokens_in,
           coalesce(sum(tokens_out), 0)::bigint     as tokens_out,
           coalesce(sum(search_calls), 0)::integer  as search_calls,
           coalesce(sum(cost_usd), 0)::numeric(12, 6) as cost_usd,
           coalesce(array_agg(distinct pricing_id) filter (where pricing_id is not null), '{}') as pricing_ids
    from public.usage_event where stage_run_id = p_id
  ) u
  where s.id = p_id and s.status = 'running' and s.attempt = p_attempt;
  get diagnostics n = row_count;
  return n = 1;
end;
$$;

-- Total estimated spend for a report so far (all stages, all attempts, failed calls included).
create function public.report_spend_usd(p_report_id uuid)
returns numeric
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(sum(u.cost_usd), 0)
  from public.usage_event u
  join public.stage_run r on r.id = u.stage_run_id
  where r.report_id = p_report_id;
$$;

do $$
declare
  f text;
begin
  foreach f in array array[
    'public.recover_expired_stage_runs()',
    'public.claim_stage_runs(integer, integer, integer)',
    'public.retry_stage_run(uuid, integer, text, timestamptz)',
    'public.finish_stage_run(uuid, integer, text, jsonb, text, text)'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end;
$$;
revoke all on function public.report_spend_usd(uuid) from public, anon;
grant execute on function public.report_spend_usd(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Read models for the run monitor (security_invoker: RLS of the caller applies)
-- ---------------------------------------------------------------------------

create view public.stage_run_overview
with (security_invoker = true)
as
select
  r.*,
  (r.version = max(r.version) over (partition by r.report_id, r.stage)) as is_latest,
  exists (select 1 from public.stage_run_stale st where st.stage_run_id = r.id) as is_stale,
  (select count(*) from public.usage_event u where u.stage_run_id = r.id and not u.succeeded) as failed_calls
from public.stage_run r;

create view public.report_cost_rollup
with (security_invoker = true)
as
select
  rep.id as report_id,
  count(r.id)                                         as stage_runs,
  count(r.id) filter (where r.status = 'failed')      as failed_runs,
  coalesce(sum(r.duration_ms), 0)::bigint             as duration_ms,
  coalesce(sum(r.tokens_in), 0)::bigint               as tokens_in,
  coalesce(sum(r.tokens_out), 0)::bigint              as tokens_out,
  coalesce(sum(r.search_calls), 0)::bigint            as search_calls,
  public.report_spend_usd(rep.id)                     as cost_usd,
  rep.spending_cap_usd
from public.report rep
left join public.stage_run r on r.report_id = rep.id
group by rep.id;

-- ---------------------------------------------------------------------------
-- Prices. Fake price for the dummy stage (proves the cost loop; no real vendor is called).
-- ---------------------------------------------------------------------------

insert into public.pricing (provider, model, version, input_usd_per_mtok, output_usd_per_mtok, search_usd_per_call, source)
values ('dummy', 'fake-model-1', 1, 1.00, 2.00, 0.01,
        'Fake price list for the Milestone 1 dummy stage. Not a real vendor; nothing is billed.');
