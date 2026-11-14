-- Pipeline stage 12 (report assembly): when a report_assemble run finishes, its output (the report JSON) becomes a new
-- report_document version in the same transaction. Documents stay append-only; the report view shows the latest one.

create function public.tg_stage_run_publish_document()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.report_document (report_id, schema_version, document, source, stage_run_id, created_by)
  values (new.report_id, coalesce(new.output ->> 'schemaVersion', 'unknown'), new.output, 'stage_run', new.id, new.created_by);
  return null;
end;
$$;
revoke all on function public.tg_stage_run_publish_document() from public, anon, authenticated;

create trigger stage_run_publish_document
  after update of status on public.stage_run
  for each row
  when (new.stage = 'report_assemble' and new.status in ('done', 'partial') and old.status = 'running'
        and jsonb_typeof(new.output) = 'object')
  execute function public.tg_stage_run_publish_document();
