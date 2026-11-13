-- report_document: admins only, append-only, fixture loading is idempotent.
begin;
create extension if not exists pgtap with schema extensions;
select plan(8);

insert into auth.users (id, email, aud, role)
values ('00000000-0000-0000-0000-00000000a001', 'admin@test.local', 'authenticated', 'authenticated'),
       ('00000000-0000-0000-0000-00000000b002', 'other@test.local', 'authenticated', 'authenticated');
insert into public.admin_user (user_id) values ('00000000-0000-0000-0000-00000000a001');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000b002","role":"authenticated"}', true);
select throws_ok(
  $$select public.load_fixture_report('t-fixture', '1.0', '{}', 'X', 'Y', 'Z', null, '{}')$$,
  '42501', null, 'non-admin cannot load a fixture report'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000a001","role":"authenticated"}', true);
create temp table first_load on commit drop as
  select public.load_fixture_report('t-fixture', '1.0', '{"a":1}', 'Test Co', 'Testing', 'Testville', 'https://test.example/', '{test.example}') as id;
select ok((select id from first_load) is not null, 'admin loads a fixture report');
select is(
  public.load_fixture_report('t-fixture', '1.0', '{"a":2}', 'Test Co', 'Testing', 'Testville', null, '{}'),
  (select id from first_load), 'loading the same fixture again returns the same report'
);
select is((select count(*)::int from public.report_document where fixture_id = 't-fixture'), 1, 'one document per fixture');
select is((select count(*)::int from public.business where name = 'Test Co'), 1, 'one business per fixture');
select throws_ok($$update public.report_document set document = '{}'$$, 'P0001', null, 'report_document: UPDATE refused');
select throws_ok($$delete from public.report_document$$, 'P0001', null, 'report_document: DELETE refused');
select throws_ok(
  $$insert into public.report_document (report_id, schema_version, document, source) select id, '1.0', '{}', 'fixture' from first_load$$,
  '23514', null, 'fixture documents need a fixture id'
);
reset role;

select * from finish();
rollback;
