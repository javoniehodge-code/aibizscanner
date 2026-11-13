-- Milestone 1: the rendered report's data. One row = one version of the report JSON (fixtures/report.schema.json).
-- Append-only: a new assembly (pipeline stage 12, later) or a reloaded fixture inserts a new row; the latest is shown.

create table public.report_document (
  id              uuid primary key default gen_random_uuid(),
  report_id       uuid not null references public.report (id) on delete restrict,
  schema_version  text not null,
  document        jsonb not null check (jsonb_typeof(document) = 'object'),
  -- fixture: an example report loaded from fixtures/; stage_run: assembled by the pipeline.
  source          text not null check (source in ('fixture', 'stage_run')),
  fixture_id      text,
  stage_run_id    uuid references public.stage_run (id) on delete restrict,
  created_by      uuid references auth.users (id) on delete set null default auth.uid(),
  created_at      timestamptz not null default now(),
  check ((source = 'fixture') = (fixture_id is not null)),
  check ((source = 'stage_run') = (stage_run_id is not null))
);
create index report_document_report_idx on public.report_document (report_id, created_at desc);
create unique index report_document_fixture_once on public.report_document (fixture_id) where fixture_id is not null;
create trigger report_document_append_only before update or delete on public.report_document
  for each row execute function public.tg_append_only();

alter table public.report_document enable row level security;
revoke all on public.report_document from anon;
create policy admin_all on public.report_document for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

-- Loads an example report (business + report + document) in one transaction. Idempotent per fixture id.
-- SECURITY INVOKER: RLS applies, so only admins can call it successfully.
create function public.load_fixture_report(
  p_fixture_id     text,
  p_schema_version text,
  p_document       jsonb,
  p_name           text,
  p_category       text,
  p_location       text,
  p_website        text,
  p_domains        text[]
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  existing uuid;
  biz uuid;
  rep uuid;
begin
  perform pg_advisory_xact_lock(hashtextextended('fixture:' || p_fixture_id, 0));
  select report_id into existing from public.report_document where fixture_id = p_fixture_id;
  if existing is not null then
    return existing;
  end if;
  insert into public.business (name, category, location, website, domains)
  values (p_name, p_category, p_location, p_website, coalesce(p_domains, '{}'))
  returning id into biz;
  insert into public.report (business_id, status, spending_cap_usd)
  values (biz, 'done', 0)
  returning id into rep;
  insert into public.report_document (report_id, schema_version, document, source, fixture_id)
  values (rep, p_schema_version, p_document, 'fixture', p_fixture_id);
  return rep;
end;
$$;
revoke all on function public.load_fixture_report(text, text, jsonb, text, text, text, text, text[]) from public, anon;
grant execute on function public.load_fixture_report(text, text, jsonb, text, text, text, text, text[]) to authenticated;
