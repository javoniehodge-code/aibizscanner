-- The Gemini engine now uses Google's alias gemini-pro-latest (gemini-3.1-pro-preview returned 404 for the owner's key).
-- The alias follows Google's current Pro model, whose price can change when it moves. Priced conservatively at the
-- highest current Pro rate found (Gemini 4 list price after its introductory period, $4 / $20 per MTok) so the spending
-- cap errs on the safe side; correct with a new version once the served model (recorded per answer) is confirmed.
insert into public.pricing (provider, model, version, input_usd_per_mtok, output_usd_per_mtok, search_usd_per_call, source)
values ('google', 'gemini-pro-latest', 1, 4.00, 20.00, 0.014,
        'Conservative: highest current Gemini Pro rate found ($4 / $20 per MTok); Google Search grounding $14 per 1k queries. Set 2026-11-13; confirm against the served model.')
on conflict (provider, model, version) do nothing;
