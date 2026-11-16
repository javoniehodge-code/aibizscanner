-- Owner decision 2026-11-16: reports measure what a typical free user sees. ChatGPT now uses gpt-6-luna (ChatGPT Free's
-- Luna model) and Gemini uses gemini-3.5-flash-lite (the free Gemini app mostly uses Flash-Lite). Claude stays on
-- claude-sonnet-5-5. Prices from the providers' API pricing pages on 2026-11-16 (standard tier).
insert into public.pricing (provider, model, version, input_usd_per_mtok, output_usd_per_mtok, search_usd_per_call, source)
values
  ('openai', 'gpt-6-luna', 1, 0.10, 0.50, 0.010,
   'OpenAI API pricing 2026-11-16: $0.10 / $0.50 per MTok; web search $10 per 1k calls, search content tokens at model rates.'),
  ('google', 'gemini-3.5-flash-lite', 1, 0.30, 2.50, 0.014,
   'Gemini API pricing 2026-11-16 (paid tier): $0.30 / $2.50 per MTok incl. thinking; Google Search grounding $14 per 1k queries after 5,000 free per month (not counted, so estimates err high).')
on conflict (provider, model, version) do nothing;
