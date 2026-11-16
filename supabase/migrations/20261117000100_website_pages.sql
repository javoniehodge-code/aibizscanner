-- Milestone 3, stage 5 (website crawl): the admin-approved list of pages to check, and the bounded bodies of the page
-- snapshots our protected fetcher takes. Both are evidence: approved sets are frozen, bodies are append-only.

-- Approved list of website pages to check for a report. A changed selection is a new version (brief §5).
create table public.website_page_set (
  id          uuid primary key default gen_random_uuid(),
  report_id   uuid not null references public.report (id) on delete restrict,
  version     integer not null check (version > 0),
  -- [{ "url": "https://example.com/faq", "kind": "faq", "reason": "FAQ page" }, ...]
  pages       jsonb not null default '[]' check (jsonb_typeof(pages) = 'array'),
  approved_by uuid references auth.users (id) on delete set null,
  approved_at timestamptz,
  created_by  uuid references auth.users (id) on delete set null default auth.uid(),
  created_at  timestamptz not null default now(),
  unique (report_id, version),
  check ((approved_by is null) = (approved_at is null))
);

create function public.tg_website_page_set_frozen_when_approved()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    if old.approved_at is not null then
      raise exception 'website_page_set % is approved and cannot be deleted', old.id using errcode = 'P0001';
    end if;
    return old;
  end if;
  if old.approved_at is not null then
    raise exception 'website_page_set % is approved and frozen; create a new version', old.id using errcode = 'P0001';
  end if;
  if new.id <> old.id or new.report_id <> old.report_id or new.version <> old.version then
    raise exception 'website_page_set identity columns cannot change' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
create trigger website_page_set_frozen before update or delete on public.website_page_set
  for each row execute function public.tg_website_page_set_frozen_when_approved();

-- Bounded body of a page snapshot: the HTML as fetched (or as rendered) and the visible main text we extracted.
create table public.page_snapshot_body (
  snapshot_id uuid primary key references public.page_snapshot (id) on delete restrict,
  html        text check (html is null or length(html) <= 2200000),
  text        text check (text is null or length(text) <= 300000),
  created_at  timestamptz not null default now()
);
create trigger page_snapshot_body_append_only before update or delete on public.page_snapshot_body
  for each row execute function public.tg_append_only();

do $$
declare
  t text;
begin
  foreach t in array array['website_page_set', 'page_snapshot_body'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon', t);
    execute format(
      'create policy admin_all on public.%I for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()))',
      t
    );
  end loop;
end;
$$;
