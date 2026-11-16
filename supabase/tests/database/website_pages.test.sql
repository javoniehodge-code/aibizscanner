-- Website page sets freeze on approval; page snapshot bodies are append-only and admin-only.
begin;
create extension if not exists pgtap with schema extensions;
select plan(6);

insert into auth.users (id, email, aud, role)
values ('00000000-0000-0000-0000-00000000a001', 'admin@test.local', 'authenticated', 'authenticated'),
       ('00000000-0000-0000-0000-00000000b002', 'other@test.local', 'authenticated', 'authenticated');
insert into public.admin_user (user_id) values ('00000000-0000-0000-0000-00000000a001');
insert into public.business (id, name, category, location) values ('10000000-0000-0000-0000-000000000001', 'Seed Co', 'Rentals', 'Miami, FL');
insert into public.report (id, business_id) values ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000a001","role":"authenticated"}', true);
select lives_ok(
  $$insert into public.website_page_set (id, report_id, version, pages, approved_by, approved_at)
    values ('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 1,
            '[{"url":"https://seed.example/","kind":"home","reason":"Home page"}]', '00000000-0000-0000-0000-00000000a001', now())$$,
  'an admin saves an approved website page set'
);
select throws_ok($$update public.website_page_set set pages = '[]'$$, 'P0001', null, 'an approved page set is frozen');
select throws_ok(
  $$insert into public.website_page_set (report_id, version, pages) values ('20000000-0000-0000-0000-000000000001', 2, '{}')$$,
  '23514', null, 'pages must be a list'
);
reset role;

set local role service_role;
insert into public.page_snapshot (id, report_id, url, fetch_mode, fetched_at)
values ('40000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'https://seed.example/', 'raw', now());
select lives_ok(
  $$insert into public.page_snapshot_body (snapshot_id, html, text) values ('40000000-0000-0000-0000-000000000001', '<html></html>', '')$$,
  'the worker stores a snapshot body'
);
select throws_ok($$update public.page_snapshot_body set text = 'x'$$, 'P0001', null, 'page_snapshot_body: UPDATE refused');
reset role;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000b002","role":"authenticated"}', true);
select is((select count(*)::int from public.page_snapshot_body), 0, 'non-admins see no snapshot bodies');
reset role;

select * from finish();
rollback;
