# Full Business Diagnostic — technical requirements summary

Status: proposed, 12 November 2026. Summary of the APIs, data and setup needed to produce the Full Business Diagnostic report end to end. It consolidates and does not replace the [technical specification](technical-specification.md) and [website discovery and accessibility process](website-discovery-accessibility.md); where they differ, those documents and the [decision log](../planning/decision-log.md) govern. Verify every provider's current API syntax, limits, pricing and terms at implementation time.

## 1. Inputs from onboarding

Per the [onboarding flow](../product/prompt-onboarding-flow.md): business name, website, location or market, selected products/services (up to five priorities), and optional customer types and customer questions. Then a generated, editable, versioned prompt list.

Add or confirm during onboarding (lessons from the Brownstone and MVP Miami test reports):

| Addition | Why |
| --- | --- |
| Confirm identity against Google Places (place ID, address, category) | Locks the business before any matching or listing check. |
| Other names and domains (e.g. "MVP Miami" / "MVP Exotics") | Mention matching misses answers without aliases. |
| Service lines and locations detected from the crawl | Multi-line businesses (cars, villas, yachts) need facts per line; sister-city sites need an explicit in/out-of-scope choice. |
| Optional owner-confirmed key facts (hours, prices or "from" prices, service area, eligibility rules) | Gives Complete and Consistent a confirmed baseline instead of treating the website as truth. |

## 2. APIs and accounts

All keys are held by AI Biz Scanner, not by each business.

| Need | API / account | Used for |
| --- | --- | --- |
| AI answers with search | OpenAI, Anthropic, Google Gemini, Perplexity — direct adapters, native search tools on | Prompt Analysis discovery runs, citations, competitor names |
| Page reading by the AI itself | Anthropic web fetch, Gemini URL Context, OpenAI page-open action where available, Perplexity URL tool where available | "Can AI read this page?" (see section 3) |
| Website-only answers | Same providers, search off, given only our snapshot of the selected pages | Complete, Distinctive. Labeled as website-only, not provider access. |
| Answer analysis | One extraction model with structured output and evidence spans | Businesses named, recommended / mentioned / warned away, position, first choice, reasons, concerns, citation types |
| Google listing data | Google Places API (one project key, billing on) | Hours, phone, website, categories, rating, review count, sample reviews for Consistent / Credible / Web Presence Map. Respect storage limits: re-fetch per report, keep place ID. |
| Yelp listing data | Yelp business data API (one key) | Rating, review count, hours, categories, review excerpts. Check current plan and display/storage terms. |
| Search-result checks (optional) | A search API (e.g. Brave Search, SerpAPI, DataForSEO) | Independent "does this page rank" diagnostics. Never substitutes for a provider's own search result. |
| Rendering | Headless Chromium (Playwright, self-hosted or a hosted service) | Our rendered snapshot for the JavaScript-visibility diagnostic only |
| Storage | Postgres + private object storage | Raw answers, citations, page snapshots, listing data, versions |

Owner-authorized APIs (Google Business Profile API, owner analytics/server logs) are later, optional additions for owner-only data or fixing listings. Not required for the diagnostic.

Sources with no usable API (most directories, editorial pages, Atly-type listings) are read through our protected fetcher or marked "Couldn't check."

## 3. Can AI read the page? Measure it the way AI reads it

Do not use a headless browser as the answer to this question. Most AI page fetchers do not execute JavaScript.

| Provider route | Executes JavaScript? | Implication |
| --- | --- | --- |
| OpenAI (GPTBot, OAI-SearchBot, ChatGPT-User) | Generally no | Content loaded by scripts is invisible |
| Anthropic (ClaudeBot, Claude-User, web fetch) | Generally no | Same |
| Perplexity (PerplexityBot, user fetch) | Generally no | Same |
| Google / Gemini (Google index, URL Context) | Google's index renders JavaScript | Closest to a rendered browser |
| Agent / browser modes (e.g. ChatGPT Atlas, computer use) | Yes | Not how ordinary answers are built; out of scope |

Re-verify this table at implementation; provider behavior changes. Reference: [Vercel, "The rise of the AI crawler"](https://vercel.com/blog/the-rise-of-the-ai-crawler).

Result per selected page and provider:

1. **Provider reading test (the answer).** Ask the provider's own URL-reading tool to open the page and return its title and page-specific passages, per [section 7 of the discovery process](website-discovery-accessibility.md#7-reading-test-can-its-web-tool-obtain-that-pages-information). This is the only result shown as "Can [AI] read this page?"
2. **Raw vs rendered diagnostic (the explanation).** Our fetcher stores the raw HTML and a rendered snapshot. If key facts (prices, inventory, hours) appear only after rendering, flag "Loads with JavaScript — likely invisible to ChatGPT, Claude and Perplexity." Labeled as our diagnostic, never as provider access.
3. **Published permissions.** robots.txt per crawler token, per the existing process.
4. **Blocking hints.** A 403/challenge on our fetch is recorded as a possible block to investigate. Sending a crawler's user-agent from our network does not prove what the provider sees; only the provider test or owner server logs can confirm it.

The MVP Miami test found this exact case: `/rentals` returned table headings and "Vehicles Found:" with no vehicles to a non-rendering reader. Report status needs a value for "Read, but key content missing" (currently forced into a note).

## 4. Other website checks

- Sitemap + navigation crawl to suggest the selected pages from onboarding offerings.
- Structured data extraction (JSON-LD, microdata, RDFa; e.g. the `extruct` library) and fact-by-fact comparison with visible page text: match / conflict / missing. Conflicts are written in plain English above developer details.
- Self-consistency: compare the same fact across the business's own pages (MVP: FAQ offers free delivery; Locations page says no drop-off).
- Search-findability test per page using each provider's native search, per section 6 of the discovery process.

## 5. Web presence, credibility and competitors

- Fetch every page the AIs cited (protected fetcher; rendered only if needed and labeled). The analysis model classifies source type and how the business appears: recommended with reason, reviewed, listed, concern, not found. Paywalled or blocked pages are "Couldn't check."
- Listings: Google Places and Yelp via API; additional directories by fetch. Additional sources stay separate from cited sources.
- Competitors: the top two other businesses recommended in the run. Run the same site crawl and listing lookups; extract comparable facts (prices, eligibility, service area, delivery, reviews) with source links.
- Licensing and official registries are industry- and state-specific (e.g. NYSDOT movers, Florida Sunbiz). Optional per-industry adapters; otherwise "Not checked."

## 6. Pipeline

1. Onboarding and identity confirmation
2. Prompt list generation → owner edits → approved, versioned prompt set
3. Discovery runs: each prompt once per engine for local businesses (per the decision log); retries fill the same slot; failures recorded as Unavailable
4. Fetch cited pages
5. Site crawl, reading tests, structured data, self-consistency
6. Listing lookups (Places, Yelp, directories)
7. Competitor lookups
8. Extraction and scoring
9. Report data JSON → report renderer → human QA (MVP) → delivery

Queue-based workers with per-step retries and budgets. Preserve raw outputs, citations, snapshots, settings and timestamps for every step.

## 7. Report data contract

One JSON document drives every slide. The renderer contains no business-specific values. The MVP Miami test found these hard-coded in the Brownstone template and had to replace them by hand:

- business and competitor IDs (coverage map columns, comparison columns)
- prompt counts and answer totals ("8 prompts", "of 23")
- per-AI explanation cards and summary sentences
- a fixed 5-point rating scale on review cards (Atly shows an unscaled 9.5)
- a headline that assumed a single lowest AI (broke on a tie at 0%)
- one fact set for the whole business (needs per-service-line facts)

The contract also needs:

- a real vs sample flag on every value, until all sources are live
- a "not found anywhere" state for presence visuals, so a business absent from every cited site gets a clear message instead of a wall of empty rows
- a slot for unsupported business claims (e.g. "celebrities' favorite") under Credible

## 8. Open choices

- Which search API, if any, for independent ranking diagnostics
- Hosted vs self-hosted rendering
- Whether owner server-log upload is offered to confirm real crawler visits
- Yelp plan tier and display rules
- Per-industry registry adapters for launch
