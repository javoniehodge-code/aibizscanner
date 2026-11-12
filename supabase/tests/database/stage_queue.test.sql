-- Job queue: enqueue/rerun versions, stale marks, claiming, fencing, retries, lease recovery, cost rollup, cron.
begin;
create extension if not exists pgtap with schema extensions;
select plan(29);

insert into auth.users (id, email, aud, role)
values ('00000000-0000-0000-0000-00000000a001', 'admin@test.local', 'authenticated', 'authenticated'),
       ('00000000-0000-0000-0000-00000000b002', 'other@test.local', 'authenticated', 'authenticated');
insert into public.admin_user (user_id) values ('00000000-0000-0000-0000-00000000a001');
insert into public.business (id, name, category, location)
values ('10000000-0000-0000-0000-000000000001', 'Seed Co', 'Movers', 'Brooklyn, NY');
insert into public.report (id, business_id, spending_cap_usd)
values ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 1);

-- ---------- enqueue as an admin ----------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000a001","role":"authenticated"}', true);

select is(
  (select version from public.enqueue_stage_run('20000000-0000-0000-0000-000000000001', 'up', '{}', 'h1', '{}', 60000, 3, '{down}')),
  1, 'first enqueue is version 1'
);
select throws_ok(
  $$select public.enqueue_stage_run('20000000-0000-0000-0000-000000000001', 'up', '{}', 'h1', '{}', 60000, 3, '{down}')$$,
  'P0001', null, 'cannot queue a stage that is already queued'
);
select throws_ok($$select * from public.claim_stage_runs(5, 60000)$$, '42501', null, 'admins cannot claim: worker only');
reset role;

-- non-admin cannot enqueue (RLS on insert)
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000b002","role":"authenticated"}', true);
select throws_ok(
  $$select public.enqueue_stage_run('20000000-0000-0000-0000-000000000001', 'other', '{}', 'h', '{}', 60000, 3, '{}')$$,
  '42501', null, 'non-admin cannot enqueue'
);
reset role;

-- ---------- worker (service_role) ----------
set local role service_role;
select is((select count(*)::int from public.claim_stage_runs(5, 1000)), 0, 'runs whose timeout exceeds the budget are not claimed');
create temp table claimed on commit drop as select * from public.claim_stage_runs(5, 120000);
grant select on claimed to public;
select is((select count(*)::int from claimed), 1, 'claims the due run');
select is((select attempt from claimed), 1, 'claim increments attempt');
select is((select status from public.stage_run where id = (select id from claimed)), 'running', 'claimed run is running');
select ok((select locked_until > now() from public.stage_run where id = (select id from claimed)), 'claim sets a lease');
select is((select count(*)::int from public.claim_stage_runs(5, 120000)), 0, 'a running run is not claimed twice');

select is(public.retry_stage_run((select id from claimed), 99, 'x', now()), false, 'retry with a stale attempt (fencing token) is ignored');
select is(public.retry_stage_run((select id from claimed), 1, 'boom', now() + interval '1 hour'), true, 'retry re-queues the run');
select is(
  (select status || ':' || coalesce(error, '') from public.stage_run where id = (select id from claimed)),
  'queued:boom', 'retried run is queued with its error'
);
select is((select count(*)::int from public.claim_stage_runs(5, 120000)), 0, 'a retried run waits for its backoff');

-- make it due again, claim attempt 2, and record a priced call
update public.stage_run set run_after = now() where id = (select id from claimed);
select is((select attempt from public.claim_stage_runs(5, 120000)), 2, 'second claim is attempt 2');
insert into public.usage_event (stage_run_id, attempt, provider, model, pricing_id, tokens_in, tokens_out, search_calls, cost_usd, duration_ms, succeeded)
select (select id from claimed), 2, 'dummy', 'fake-model-1', p.id, 1200, 300, 1, 0.0118, 250, true
from public.pricing p where p.provider = 'dummy' and p.model = 'fake-model-1';
select is(public.finish_stage_run((select id from claimed), 1, 'done', '{}', 'oh', null), false, 'finish with an old attempt is ignored');
select is(public.finish_stage_run((select id from claimed), 2, 'done', '{"answer":"x"}', 'oh', null), true, 'finish succeeds for the current attempt');
select results_eq(
  $$select status, tokens_in, tokens_out, search_calls, cost_usd from public.stage_run where id = (select id from claimed)$$,
  $$values ('done'::text, 1200::bigint, 300::bigint, 1, 0.0118::numeric(12,6))$$,
  'finish rolls usage up from usage_event'
);
select ok(
  (select array_length(pricing_ids, 1) = 1 and duration_ms is not null from public.stage_run where id = (select id from claimed)),
  'finished run records the pricing row and duration'
);
select is(public.report_spend_usd('20000000-0000-0000-0000-000000000001'), 0.0118::numeric, 'report spend sums usage');
reset role;

-- ---------- downstream + rerun -> stale ----------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000a001","role":"authenticated"}', true);
create temp table down1 on commit drop as
  select * from public.enqueue_stage_run('20000000-0000-0000-0000-000000000001', 'down', '{}', 'h2',
    array[(select id from claimed)], 60000, 3, '{}');
grant select on down1 to public;
select is(
  (select count(*)::int from public.stage_run_overview where id = (select id from down1) and is_stale),
  0, 'downstream run starts fresh'
);
create temp table up2 on commit drop as
  select * from public.enqueue_stage_run('20000000-0000-0000-0000-000000000001', 'up', '{}', 'h1', '{}', 60000, 3, '{down}');
grant select on up2 to public;
select is((select version from up2), 2, 'rerun creates version 2');
select is(
  (select count(*)::int from public.stage_run where report_id = '20000000-0000-0000-0000-000000000001' and stage = 'up'),
  2, 'rerun keeps version 1'
);
select ok(
  (select is_stale from public.stage_run_overview where id = (select id from down1)),
  'rerunning an upstream stage marks the latest downstream run stale'
);
select ok(
  (select is_latest from public.stage_run_overview where id = (select id from up2))
  and not (select is_latest from public.stage_run_overview where id = (select id from claimed)),
  'overview flags the latest version'
);
select is(
  (select stage_runs::int from public.report_cost_rollup where report_id = '20000000-0000-0000-0000-000000000001'),
  3, 'cost rollup counts every run'
);
reset role;

-- ---------- lease recovery ----------
set local role service_role;
update public.stage_run set run_after = now() - interval '1 second' where id = (select id from down1);
-- claim everything due (down1 and up2), then expire their leases
select ok((select count(*) from public.claim_stage_runs(5, 120000)) = 2, 'claims both due runs');
update public.stage_run set locked_until = now() - interval '1 second' where status = 'running';
select is(public.recover_expired_stage_runs(), 2, 'expired leases are recovered');
reset role;

-- ---------- cron ----------
select is(
  (select schedule from cron.job where jobname = 'worker-tick'),
  '* * * * *', 'worker tick is scheduled every minute'
);

select * from finish();
rollback;
