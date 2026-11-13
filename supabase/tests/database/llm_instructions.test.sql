-- Instruction versions, LLM call records and eval cases.
begin;
create extension if not exists pgtap with schema extensions;
select plan(11);

insert into auth.users (id, email, aud, role)
values ('00000000-0000-0000-0000-00000000a001', 'admin@test.local', 'authenticated', 'authenticated');
insert into public.admin_user (user_id) values ('00000000-0000-0000-0000-00000000a001');
insert into public.business (id, name, category, location) values ('10000000-0000-0000-0000-000000000001', 'Seed Co', 'Movers', 'Somewhere');
insert into public.report (id, business_id) values ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001');

-- enqueue records instruction versions; they are frozen with the run's other inputs
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000a001","role":"authenticated"}', true);
create temp table r1 on commit drop as
  select * from public.enqueue_stage_run('20000000-0000-0000-0000-000000000001', 'x', '{}', 'h', '{}', 60000, 3, '{}',
    '[{"id":"m/task","version":1,"sha256":"aaaa"}]');
grant select on r1 to public;
select is((select instruction_refs -> 0 ->> 'id' from r1), 'm/task', 'enqueue records instruction versions');
select lives_ok(
  $$select public.enqueue_stage_run('20000000-0000-0000-0000-000000000001', 'y', '{}', 'h', '{}', 60000, 3, '{}')$$,
  'instruction versions default to none'
);
select throws_ok($$update public.stage_run set instruction_refs = '[]' where id = (select id from r1)$$, 'P0001', null, 'instruction versions cannot change');
select throws_ok($$select public.record_llm_instruction('m/task', 1, repeat('a', 64), 'text')$$, '42501', null, 'admins cannot write instructions: worker only');
reset role;

set local role service_role;
select lives_ok($$select public.record_llm_instruction('m/task', 1, repeat('a', 64), 'text v1')$$, 'worker stores an instruction version');
select lives_ok($$select public.record_llm_instruction('m/task', 1, repeat('a', 64), 'text v1')$$, 'storing the same version again is a no-op');
select throws_ok($$select public.record_llm_instruction('m/task', 1, repeat('b', 64), 'changed')$$, 'P0001', null, 'changed text under the same version is refused');
select lives_ok(
  $$insert into public.llm_call (stage_run_id, attempt, instruction_id, instruction_version, provider, model, valid, error, duration_ms)
    values ((select id from r1), 1, 'm/task', 1, 'fake', 'fake-1', false, 'not JSON', 5)$$,
  'an invalid call is recorded'
);
select throws_ok(
  $$insert into public.llm_call (stage_run_id, attempt, instruction_id, instruction_version, provider, model, valid, duration_ms)
    values ((select id from r1), 1, 'm/task', 1, 'fake', 'fake-1', true, 5)$$,
  '23514', null, 'a valid call must carry its output'
);
select throws_ok($$update public.llm_call set error = null$$, 'P0001', null, 'llm_call is append-only');
reset role;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000a001","role":"authenticated"}', true);
select lives_ok(
  $$insert into public.eval_case (task, input, expected) values ('m/task', '{"answer":"x"}', '{"named":[]}')$$,
  'admin records a human-verified eval case (verified_by defaults to them)'
);
reset role;

select * from finish();
rollback;
