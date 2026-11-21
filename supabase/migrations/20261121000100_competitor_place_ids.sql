-- Milestone 5b: competitors' Google listings. Only place IDs are stored (Places API policies allow storing place IDs
-- indefinitely); ratings and every other field are read when the report is opened and never stored. Keyed by the
-- competitor's name as AI wrote it, lowercased: {"mph club": {"id": "ChIJ…", "at": "2026-11-21"}}; "id" is null when
-- Google found no listing with that name, so it isn't searched again on every view.
alter table public.report
  add column competitor_place_ids jsonb not null default '{}'::jsonb
  constraint report_competitor_place_ids_object check (jsonb_typeof(competitor_place_ids) = 'object');
