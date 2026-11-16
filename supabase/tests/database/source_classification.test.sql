-- Cited-page classification cache: worker writes, admins read, one row per page key and classifier version, append-only.
begin;
create extension if not exists pgtap with schema extensions;
select plan(6);

insert into auth.users (id, email, aud, role)
values ('00000000-0000-0000-0000-00000000a001', 'admin@test.local', 'authenticated', 'authenticated'),
       ('00000000-0000-0000-0000-00000000b002', 'other@test.local', 'authenticated', 'authenticated');
insert into public.admin_user (user_id) values ('00000000-0000-0000-0000-00000000a001');
insert into public.business (id, name, category, location) values ('10000000-0000-0000-0000-000000000001', 'Seed Co', 'Rentals', 'Miami, FL');
insert into public.report (id, business_id) values ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001');

set local role service_role;
create temp table run on commit drop as
  select * from public.enqueue_stage_run('20000000-0000-0000-0000-000000000001', 'pa_sources', '{}', 'h', '{}', 240000, 2, '{}');
grant select on run to public;
select lives_ok(
  $$insert into public.source_classification (page_key, classifier_version, source_group, unclassified, reason, evidence, model, stage_run_id)
    values ('mphclub.com/miami', 'v1', 'company', null, 'Own page.', 'mph club', 'm', (select id from run))$$,
  'the worker caches a classification'
);
select throws_ok(
  $$insert into public.source_classification (page_key, classifier_version, source_group, unclassified, reason, model, stage_run_id)
    values ('mphclub.com/miami', 'v1', 'dir', null, 'x', 'm', (select id from run))$$,
  '23505', null, 'one row per page key and classifier version'
);
select throws_ok(
  $$insert into public.source_classification (page_key, classifier_version, source_group, unclassified, reason, model, stage_run_id)
    values ('x.com/a', 'v1', 'unc', null, 'x', 'm', (select id from run))$$,
  '23514', null, 'an unclassified page says why (outside or insufficient)'
);
select throws_ok($$update public.source_classification set reason = 'y'$$, 'P0001', null, 'source_classification: UPDATE refused');
reset role;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000a001","role":"authenticated"}', true);
select is((select count(*)::int from public.source_classification), 1, 'admins read the cache');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000b002","role":"authenticated"}', true);
select is((select count(*)::int from public.source_classification), 0, 'non-admins see nothing');
reset role;

select * from finish();
rollback;
