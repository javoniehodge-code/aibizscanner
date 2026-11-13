-- Milestone 2 prompt analysis: model prices, prompt set fields, engine answers as append-only evidence.
begin;
create extension if not exists pgtap with schema extensions;
select plan(8);

insert into auth.users (id, email, aud, role)
values ('00000000-0000-0000-0000-00000000a001', 'admin@test.local', 'authenticated', 'authenticated');
insert into public.admin_user (user_id) values ('00000000-0000-0000-0000-00000000a001');
insert into public.business (id, name, category, location) values ('10000000-0000-0000-0000-000000000001', 'Seed Co', 'Rentals', 'Miami, FL');
insert into public.report (id, business_id) values ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001');

select results_eq(
  $$select provider || '/' || model from public.pricing where provider in ('openai', 'anthropic', 'google') order by 1$$,
  $$values ('anthropic/claude-haiku-5-5'), ('anthropic/claude-opus-5-5'), ('google/gemini-3.1-pro-preview'), ('openai/gpt-6.1-sol')$$,
  'every model the prompt analysis uses has a price'
);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000a001","role":"authenticated"}', true);
select lives_ok(
  $$insert into public.prompt_set (id, report_id, version, prompts, groups, customer_location, approved_by, approved_at)
    values ('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 1,
            '[{"id":"P1","group":0,"demand":"Observed demand","text":"Best exotic car rental in Miami"}]',
            '[{"name":"Baseline","description":"General"}]',
            '{"city":"Miami","region":"Florida","country":"US","timezone":"America/New_York"}',
            '00000000-0000-0000-0000-00000000a001', now())$$,
  'an admin saves an approved prompt set with groups and customer location'
);
select throws_ok(
  $$update public.prompt_set set groups = '[]' where id = '30000000-0000-0000-0000-000000000001'$$,
  'P0001', null, 'an approved prompt set is frozen'
);
select throws_ok(
  $$insert into public.prompt_set (report_id, version, groups) values ('20000000-0000-0000-0000-000000000001', 2, '{}')$$,
  '23514', null, 'groups must be a list'
);
reset role;

set local role service_role;
create temp table run on commit drop as
  select * from public.enqueue_stage_run('20000000-0000-0000-0000-000000000001', 'pa_answers_chatgpt', '{}', 'h', '{}', 280000, 2, '{}');
grant select on run to public;
select lives_ok(
  $$insert into public.engine_answer (id, report_id, prompt_set_id, prompt_id, prompt_text, engine, model, status, requested_at, stage_run_id, raw_response, citations)
    values ('40000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001',
            'P1', 'Best exotic car rental in Miami', 'chatgpt', 'gpt-6.1-sol', 'ok', now(), (select id from run),
            '{"id":"resp_1"}', '[{"url":"https://mvpmiami.com/"}]')$$,
  'the worker stores an engine answer with its raw response'
);
select throws_ok(
  $$update public.engine_answer set answer_text = 'edited' where id = '40000000-0000-0000-0000-000000000001'$$,
  'P0001', null, 'engine answers cannot be edited'
);
select throws_ok(
  $$delete from public.engine_answer where id = '40000000-0000-0000-0000-000000000001'$$,
  'P0001', null, 'engine answers cannot be deleted'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000a001","role":"authenticated"}', true);
select is((select count(*)::int from public.engine_answer), 1, 'admins can read engine answers');
reset role;

select * from finish();
rollback;
