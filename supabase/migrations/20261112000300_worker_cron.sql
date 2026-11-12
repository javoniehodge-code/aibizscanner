-- Milestone 1: call the worker endpoint every minute with pg_cron + pg_net (both free, built into Supabase).
-- Vercel Hobby cron only runs daily, so scheduling lives in the database.
--
-- The URL and the shared secret come from Supabase Vault, never from this file. Set them once, in the SQL editor:
--
--   select vault.create_secret('https://<your-app>.vercel.app/api/worker/tick', 'worker_tick_url');
--   select vault.create_secret('<same value as CRON_SECRET in Vercel>', 'worker_cron_secret');
--
-- To change one later:  select vault.update_secret(id, '<new value>') from vault.secrets where name = 'worker_tick_url';
-- Until both exist the job runs every minute and does nothing (it logs a notice).

create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

create schema if not exists app_private;
revoke all on schema app_private from public, anon, authenticated;
comment on schema app_private is 'Internal functions not exposed through the Data API.';

create function app_private.invoke_worker_tick()
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
    timeout_milliseconds := 60000
  ) into request;
  return request;
end;
$$;
revoke all on function app_private.invoke_worker_tick() from public, anon, authenticated;

-- Idempotent: re-running the migration replaces the job instead of adding a second one.
select cron.unschedule(jobid) from cron.job where jobname = 'worker-tick';
select cron.schedule('worker-tick', '* * * * *', 'select app_private.invoke_worker_tick()');
