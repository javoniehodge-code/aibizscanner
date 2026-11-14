-- Stage 12: a finished report_assemble run publishes its output as a new report_document version.
begin;
create extension if not exists pgtap with schema extensions;
select plan(5);

insert into public.business (id, name, category, location) values ('10000000-0000-0000-0000-000000000001', 'Seed Co', 'Rentals', 'Miami, FL');
insert into public.report (id, business_id) values ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001');

set local role service_role;
create temp table run on commit drop as
  select * from public.enqueue_stage_run('20000000-0000-0000-0000-000000000001', 'report_assemble', '{}', 'h1', '{}', 20000, 1, '{}');
create temp table other on commit drop as
  select * from public.enqueue_stage_run('20000000-0000-0000-0000-000000000001', 'pa_assemble', '{}', 'h2', '{}', 20000, 1, '{}');
grant select on run, other to public;
select is((select count(*)::int from public.claim_stage_runs(5, 60000)), 2, 'the worker claims both runs');

select ok(public.finish_stage_run((select id from other), 1, 'done', '{"schemaVersion":"1.0","x":1}', 'o2', null), 'another stage finishes');
select is((select count(*)::int from public.report_document), 0, 'other stages publish no document');

select ok(public.finish_stage_run((select id from run), 1, 'done', '{"schemaVersion":"1.0","x":2}', 'o1', null), 'report_assemble finishes');
select results_eq(
  $$select report_id, schema_version, document, source, stage_run_id from public.report_document$$,
  $$select '20000000-0000-0000-0000-000000000001'::uuid, '1.0', '{"schemaVersion":"1.0","x":2}'::jsonb, 'stage_run', (select id from run)$$,
  'its output becomes a report document linked to the run'
);
reset role;

select * from finish();
rollback;
