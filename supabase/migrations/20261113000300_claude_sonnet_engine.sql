-- The Claude engine now uses Claude Sonnet 5.5 (owner decision after the first run, 13 Nov 2026).
-- The Opus price row stays: past runs keep pointing at the price they were costed with.
insert into public.pricing (provider, model, version, input_usd_per_mtok, output_usd_per_mtok, search_usd_per_call, source)
values ('anthropic', 'claude-sonnet-5-5', 1, 2.00, 10.00, 0.010,
        'Anthropic price list: $2 / $10 per MTok; web search $10 per 1k searches. Checked 2026-11-13.')
on conflict (provider, model, version) do nothing;
