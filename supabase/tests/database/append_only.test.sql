-- Append-only and freeze rules, enforced by triggers for every role (including admins and service_role).
begin;
create extension if not exists pgtap with schema extensions;
select plan(29);

insert into auth.users (id, email, aud, role)
values ('00000000-0000-0000-0000-00000000a001', 'admin@test.local', 'authenticated', 'authenticated');
insert into public.admin_user (user_id) values ('00000000-0000-0000-0000-00000000a001');
insert into public.business (id, name, category, location)
values ('10000000-0000-0000-0000-000000000001', 'Seed Co', 'Movers', 'Brooklyn, NY');
insert into public.report (id, business_id)
values ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001');
insert into public.prompt_set (id, report_id, version, prompts)
values ('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 1,
        '[{"id":"p1","text":"best movers in brooklyn","group":"discovery","order":1}]');
insert into public.pricing (id, provider, model, version, input_usd_per_mtok, source)
overriding system value values (900001, 'test', 'test-model', 1, 1, 'test');

-- Run every check as an admin through the API role, so RLS allows the statement and only the trigger can refuse it.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000a001","role":"authenticated"}', true);

-- ---------- engine_answer ----------
insert into public.engine_answer (id, report_id, prompt_set_id, prompt_id, prompt_text, engine, model, status, requested_at, answer_text)
values ('40000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001',
        '30000000-0000-0000-0000-000000000001', 'p1', 'best movers in brooklyn', 'claude', 'test', 'ok', now(), 'original');
select throws_ok($$update public.engine_answer set answer_text = 'changed'$$, 'P0001', null, 'engine_answer: UPDATE refused');
select throws_ok($$delete from public.engine_answer$$, 'P0001', null, 'engine_answer: DELETE refused');
select lives_ok(
  $$insert into public.engine_answer (report_id, prompt_set_id, prompt_id, prompt_text, engine, model, status, requested_at)
    values ('20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 'p1', 'best movers in brooklyn', 'claude', 'test', 'ok', now())$$,
  'engine_answer: retry inserts a new row in the same slot'
);
select is((select answer_text from public.engine_answer where id = '40000000-0000-0000-0000-000000000001'), 'original', 'engine_answer: original kept');
select throws_ok(
  $$insert into public.engine_answer (report_id, prompt_set_id, prompt_id, prompt_text, engine, model, status, requested_at)
    values ('20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 'p1', 'x', 'perplexity', 'test', 'ok', now())$$,
  '23514', null, 'engine_answer: only the three v1 engines'
);

-- ---------- page_snapshot ----------
insert into public.page_snapshot (report_id, url, fetch_mode, fetched_at)
values ('20000000-0000-0000-0000-000000000001', 'https://example.com/', 'raw', now());
select throws_ok($$update public.page_snapshot set http_status = 200$$, 'P0001', null, 'page_snapshot: UPDATE refused');
select throws_ok($$delete from public.page_snapshot$$, 'P0001', null, 'page_snapshot: DELETE refused');
select throws_ok(
  $$insert into public.page_snapshot (url, fetch_mode, fetched_at) values ('https://example.com/', 'engine_tool', now())$$,
  '23514', null, 'page_snapshot: engine_tool fetches must name the engine'
);

-- ---------- listing_snapshot ----------
insert into public.listing_snapshot (report_id, source, raw_payload, fetched_at)
values ('20000000-0000-0000-0000-000000000001', 'google_places', '{}', now());
select throws_ok($$update public.listing_snapshot set source = 'yelp'$$, 'P0001', null, 'listing_snapshot: UPDATE refused');
select throws_ok($$delete from public.listing_snapshot$$, 'P0001', null, 'listing_snapshot: DELETE refused');

-- ---------- pricing ----------
select throws_ok($$update public.pricing set input_usd_per_mtok = 2 where id = 900001$$, 'P0001', null, 'pricing: UPDATE refused (new version instead)');
select throws_ok($$delete from public.pricing where id = 900001$$, 'P0001', null, 'pricing: DELETE refused');

-- ---------- stage_run ----------
insert into public.stage_run (id, report_id, stage, version, inputs_hash)
values ('50000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'dummy', 1, 'h1');
select lives_ok(
  $$update public.stage_run set status = 'running', attempt = 1, started_at = now(), locked_until = now() + interval '1 minute'
    where id = '50000000-0000-0000-0000-000000000001'$$,
  'stage_run: unfinished run may change status'
);
select lives_ok(
  $$update public.stage_run set tokens_in = 10, tokens_out = 5, search_calls = 1, cost_usd = 0.01
    where id = '50000000-0000-0000-0000-000000000001'$$,
  'stage_run: unfinished run may record usage'
);
select throws_ok(
  $$update public.stage_run set inputs_hash = 'other' where id = '50000000-0000-0000-0000-000000000001'$$,
  'P0001', null, 'stage_run: inputs hash cannot change'
);
select throws_ok(
  $$update public.stage_run set stage = 'other' where id = '50000000-0000-0000-0000-000000000001'$$,
  'P0001', null, 'stage_run: stage cannot change'
);
select throws_ok(
  $$update public.stage_run set version = 9 where id = '50000000-0000-0000-0000-000000000001'$$,
  'P0001', null, 'stage_run: version cannot change'
);
select throws_ok(
  $$update public.stage_run set status = 'done' where id = '50000000-0000-0000-0000-000000000001'$$,
  '23514', null, 'stage_run: done requires finished_at'
);
select lives_ok(
  $$update public.stage_run set status = 'done', finished_at = now(), duration_ms = 12, output = '{"ok":true}'
    where id = '50000000-0000-0000-0000-000000000001'$$,
  'stage_run: run can finish'
);
select throws_ok(
  $$update public.stage_run set status = 'failed' where id = '50000000-0000-0000-0000-000000000001'$$,
  'P0001', null, 'stage_run: finished run status is frozen'
);
select throws_ok(
  $$update public.stage_run set cost_usd = 0 where id = '50000000-0000-0000-0000-000000000001'$$,
  'P0001', null, 'stage_run: finished run usage is frozen'
);
select throws_ok($$delete from public.stage_run$$, 'P0001', null, 'stage_run: DELETE refused');
select throws_ok(
  $$insert into public.stage_run (report_id, stage, version, inputs_hash)
    values ('20000000-0000-0000-0000-000000000001', 'dummy', 1, 'h2')$$,
  '23505', null, 'stage_run: a rerun cannot reuse a version'
);
select lives_ok(
  $$insert into public.stage_run (report_id, stage, version, inputs_hash)
    values ('20000000-0000-0000-0000-000000000001', 'dummy', 2, 'h2')$$,
  'stage_run: rerun creates a new version row'
);

-- ---------- usage_event ----------
insert into public.usage_event (stage_run_id, attempt, provider, model, pricing_id, cost_usd, duration_ms, succeeded)
values ('50000000-0000-0000-0000-000000000001', 1, 'test', 'test-model', 900001, 0.01, 5, true);
select throws_ok($$update public.usage_event set cost_usd = 0$$, 'P0001', null, 'usage_event: UPDATE refused');

-- ---------- prompt_set ----------
select lives_ok(
  $$update public.prompt_set set prompts = '[]' where id = '30000000-0000-0000-0000-000000000001'$$,
  'prompt_set: draft may be edited'
);
update public.prompt_set
  set approved_by = '00000000-0000-0000-0000-00000000a001', approved_at = now()
  where id = '30000000-0000-0000-0000-000000000001';
select throws_ok(
  $$update public.prompt_set set prompts = '[]' where id = '30000000-0000-0000-0000-000000000001'$$,
  'P0001', null, 'prompt_set: approved set is frozen'
);

-- ---------- finding provenance rules ----------
select throws_ok(
  $$insert into public.finding (report_id, section, claim, provenance)
    values ('20000000-0000-0000-0000-000000000001', 'prompt', 'x', 'observed')$$,
  '23514', null, 'finding: observed requires evidence'
);
select throws_ok(
  $$insert into public.finding (report_id, section, claim, provenance)
    values ('20000000-0000-0000-0000-000000000001', 'prompt', 'x', 'missing')$$,
  '23514', null, 'finding: missing requires a reason'
);

reset role;
select * from finish();
rollback;
