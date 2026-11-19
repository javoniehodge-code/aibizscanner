-- Milestone 4b: the business's Google listing, confirmed by an admin. Only the place ID is stored (Places API
-- policies allow storing place IDs indefinitely; other Google content is fetched when needed and not stored). The date
-- lets us refresh IDs older than 12 months, as Google recommends.
alter table public.business add column place_id_confirmed_at timestamptz;
