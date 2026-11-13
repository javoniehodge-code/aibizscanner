-- RLS: only users present in admin_user can read or write; anon and non-admin users see nothing.
begin;
create extension if not exists pgtap with schema extensions;
select plan(24);

-- Fixtures (as the migration owner, which bypasses RLS)
insert into auth.users (id, email, aud, role)
values ('00000000-0000-0000-0000-00000000a001', 'admin@test.local', 'authenticated', 'authenticated'),
       ('00000000-0000-0000-0000-00000000b002', 'other@test.local', 'authenticated', 'authenticated');
insert into public.admin_user (user_id) values ('00000000-0000-0000-0000-00000000a001');
insert into public.business (id, name, category, location)
values ('10000000-0000-0000-0000-000000000001', 'Seed Co', 'Movers', 'Brooklyn, NY');

-- Every table in public has RLS enabled
select is(
  (select count(*)::int from pg_tables where schemaname = 'public' and not rowsecurity),
  0,
  'every public table has row level security enabled'
);

-- ---------- anon ----------
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select throws_ok($$select count(*) from public.business$$, '42501', null, 'anon cannot read business');
select throws_ok($$select count(*) from public.admin_user$$, '42501', null, 'anon cannot read admin_user');
select throws_ok(
  $$insert into public.business (name, category, location) values ('x', 'y', 'z')$$,
  '42501', null, 'anon cannot insert business'
);
select throws_ok($$select public.is_admin()$$, '42501', null, 'anon cannot call is_admin');
select throws_ok($$select public.health_check()$$, '42501', null, 'anon cannot call health_check');
reset role;

-- ---------- signed-in, not in admin_user ----------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000b002","role":"authenticated"}', true);
select is(public.is_admin(), false, 'non-admin: is_admin() is false');
select is((select count(*)::int from public.business), 0, 'non-admin sees no businesses');
select is((select count(*)::int from public.admin_user), 0, 'non-admin sees no admin_user rows');
select throws_ok(
  $$insert into public.business (name, category, location) values ('x', 'y', 'z')$$,
  '42501', null, 'non-admin cannot insert business'
);
select throws_ok(
  $$insert into public.admin_user (user_id) values ('00000000-0000-0000-0000-00000000b002')$$,
  '42501', null, 'non-admin cannot add themselves to admin_user'
);
update public.business set name = 'hacked' where id = '10000000-0000-0000-0000-000000000001';
select throws_ok($$select public.health_check()$$, '42501', 'not authorized', 'non-admin health_check is refused');
reset role;
select is(
  (select name from public.business where id = '10000000-0000-0000-0000-000000000001'),
  'Seed Co',
  'non-admin update silently affects no rows'
);

-- ---------- admin ----------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000a001","role":"authenticated"}', true);
select is(public.is_admin(), true, 'admin: is_admin() is true');
select is((select count(*)::int from public.business), 1, 'admin sees businesses');
select is((select count(*)::int from public.admin_user), 1, 'admin can read admin_user');
select lives_ok(
  $$insert into public.business (name, category, location) values ('Second', 'Cafe', 'Miami, FL')$$,
  'admin can insert business'
);
select is(
  (select created_by from public.business where name = 'Second'),
  '00000000-0000-0000-0000-00000000a001'::uuid,
  'created_by defaults to the signed-in user'
);
select lives_ok(
  $$update public.business set service_area = 'NYC' where id = '10000000-0000-0000-0000-000000000001'$$,
  'admin can update business'
);
select lives_ok(
  $$insert into public.report (business_id) values ('10000000-0000-0000-0000-000000000001')$$,
  'admin can create a report'
);
select throws_ok(
  $$insert into public.admin_user (user_id) values ('00000000-0000-0000-0000-00000000b002')$$,
  '42501', null, 'even an admin cannot add admins through the API'
);
select ok((public.health_check() ->> 'db_time') is not null, 'admin health_check returns db time');
select ok(
  (public.health_check() ->> 'latest_migration') is not null,
  'admin health_check reports the latest migration'
);
reset role;

-- ---------- data integrity checks ----------
select throws_ok(
  $$insert into public.business (name, category, location) values ('  ', 'Cafe', 'Miami')$$,
  '23514', null, 'blank business name is rejected'
);

select * from finish();
rollback;
