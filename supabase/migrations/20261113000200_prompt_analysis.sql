-- Milestone 2: prompt analysis with real AI engines.

-- ---------------------------------------------------------------------------
-- Prices for the models in web/src/engine/modules/prompt-analysis/models.ts.
-- Checked 2026-11-13 from the providers' published price lists (via search; the docs sites were not reachable from
-- the build session). Confirm against your provider dashboards; a correction is a new row with version + 1.
-- Gemini: grounding with Google Search has a monthly free allowance; we price every search to stay conservative.
-- ---------------------------------------------------------------------------
insert into public.pricing (provider, model, version, input_usd_per_mtok, output_usd_per_mtok, search_usd_per_call, source)
values
  ('openai', 'gpt-6.1-sol', 1, 2.00, 10.00, 0.010,
   'developers.openai.com/api/docs/pricing: $2 / $10 per MTok; web search $10 per 1k calls (search content billed as input tokens). Checked 2026-11-13.'),
  ('anthropic', 'claude-opus-5-5', 1, 4.00, 20.00, 0.010,
   'Anthropic price list: $4 / $20 per MTok; web search $10 per 1k searches. Checked 2026-11-13.'),
  ('anthropic', 'claude-haiku-5-5', 1, 0.10, 0.50, 0,
   'Anthropic price list: $0.10 / $0.50 per MTok for prompts up to 100K tokens. Checked 2026-11-13.'),
  ('google', 'gemini-3.1-pro-preview', 1, 2.00, 12.00, 0.014,
   'ai.google.dev/gemini-api/docs/pricing: $2 / $12 per MTok (prompts up to 200K); Google Search grounding $14 per 1k queries after the free allowance. Checked 2026-11-13.')
on conflict (provider, model, version) do nothing;

-- ---------------------------------------------------------------------------
-- Prompt sets carry their question groups and the approximate customer location sent to the engines.
-- ---------------------------------------------------------------------------
alter table public.prompt_set
  add column groups jsonb not null default '[]' check (jsonb_typeof(groups) = 'array'),
  add column customer_location jsonb check (customer_location is null or jsonb_typeof(customer_location) = 'object');
comment on column public.prompt_set.prompts is
  '[{ "id": "P1", "group": 0, "demand": "Observed demand", "text": "..." }, ...] (group indexes into groups)';
comment on column public.prompt_set.groups is '[{ "name": "Baseline", "description": "..." }, ...]';
comment on column public.prompt_set.customer_location is
  '{ "city": "Miami", "region": "Florida", "country": "US", "timezone": "America/New_York" } or null';

-- ---------------------------------------------------------------------------
-- The worker now runs up to 300 s per tick (AI engines with web search are slow). Wait for it that long.
-- ---------------------------------------------------------------------------
create or replace function app_private.invoke_worker_tick()
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  tick_url text;
  secret   text;
  request  bigint;
begin
  select decrypted_secret into tick_url from vault.decrypted_secrets where name = 'worker_tick_url';
  select decrypted_secret into secret   from vault.decrypted_secrets where name = 'worker_cron_secret';
  if tick_url is null or secret is null then
    raise notice 'worker tick skipped: vault secrets worker_tick_url and worker_cron_secret are not both set';
    return null;
  end if;
  select net.http_post(
    url                  := tick_url,
    headers              := jsonb_build_object('Authorization', 'Bearer ' || secret, 'Content-Type', 'application/json'),
    body                 := jsonb_build_object('source', 'pg_cron'),
    timeout_milliseconds := 300000
  ) into request;
  return request;
end;
$$;
revoke all on function app_private.invoke_worker_tick() from public, anon, authenticated;
