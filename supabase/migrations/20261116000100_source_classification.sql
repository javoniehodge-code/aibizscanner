-- Cited-page classification cache (pa_sources). One row per page key and classifier version, written by the worker
-- when the model fallback classifies a page that no verified rule covers. Append-only: a new classifier version
-- creates new rows, so earlier reports can still be traced to the verdict they used.

create table public.source_classification (
  id                 uuid primary key default gen_random_uuid(),
  page_key           text not null check (length(page_key) between 1 and 2000),
  classifier_version text not null,
  -- company, maps, review, dir, ed, comm, off, unc (company splits into Your website / Other businesses by ownership)
  source_group       text not null check (source_group in ('company', 'maps', 'review', 'dir', 'ed', 'comm', 'off', 'unc')),
  unclassified       text check (unclassified in ('outside', 'insufficient')),
  reason             text not null,
  evidence           text,
  model              text not null,
  stage_run_id       uuid not null references public.stage_run (id) on delete restrict,
  created_at         timestamptz not null default now(),
  unique (page_key, classifier_version),
  check ((source_group = 'unc') = (unclassified is not null))
);
comment on table public.source_classification is
  'Model classifications of cited pages, cached by page key and classifier version (instruction version + model).';

create trigger source_classification_append_only before update or delete on public.source_classification
  for each row execute function public.tg_append_only();

alter table public.source_classification enable row level security;
revoke all on public.source_classification from anon;
-- Admins read; only the worker (service role, which bypasses RLS) writes.
create policy admin_read on public.source_classification for select to authenticated using ((select public.is_admin()));
