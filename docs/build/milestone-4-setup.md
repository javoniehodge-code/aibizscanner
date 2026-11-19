# Milestone 4 setup: web presence

Milestone 4 fills the report's web presence slides (Citation coverage, Credible & corroborated, the web presence map,
Consistent & current). This page grows as each part lands.

## Owner decisions (19 Nov 2026)

- **Cited pages:** we fetch at most **20** of the outside pages AI cited per report, the most-cited first.
- **Google Places:** approved, **with reviews** (the Enterprise + Atmosphere fields). Google content is re-fetched for
  each report; we keep only the place ID. Google values shown in a finished report are replaced with "re-fetch to view"
  after 30 days. The key goes in Vercel's environment variables, never in the repository.
- **Yelp:** left out for now (no free tier, and its terms limit caching and use with AI models). A Yelp page that AI
  cites is handled like any other cited page: its robots.txt asks checkers like ours not to fetch it, so it shows as
  "couldn't check", never as missing.

## Part 4a-1: the outside pages AI cited (stage 8, collection)

Nothing to configure: no new keys, vendors or costs.

Stages: `wp_pages` (check the cited outside pages), then `wp_section` (build the report parts), then `report_assemble`.
Run `wp_pages` from the run monitor once the prompt analysis has finished; the other two follow automatically.

What it does:

1. **Ranks** the cited pages that aren't a company's own website (maps, reviews, directories, editorial, communities,
   official, unclassified) by the distinct prompts that cited them; ties by answers, then page key. A page counts once
   per prompt however many AIs cited it.
2. **Follows each site's robots.txt** for our own checker (`AIBizScannerBot`). A page it disallows isn't fetched.
3. **Reads the page:** a plain fetch first; if that is refused or has fewer than 150 words, our headless browser (or an
   earlier browser copy from this report). Browser loads start within a 200-second budget; pages not reached are
   marked "not reached in time" and a rerun picks them up. Every copy is stored as a page snapshot. We read the whole
   page body (without navigation, header, footer and forms), since listings can name businesses outside the main area.
   When different pages of one site give us exactly the same text, we got a shared shell (a consent, block or loading
   page), so those pages count as unread.
4. **Finds business names** in plain code: the target (with its aliases) and every business the prompt analysis names.
   Multi-word names match in any letter case; a one-word name must be written with its capitals ("Turo", not "turo").
5. **Citation coverage:** one row per website with a page we read, ticking each business its pages name, with a scope
   line saying how many pages were read and why the rest weren't. A site we couldn't read is left out, never shown as
   a row of blanks.

What it isn't: a check of a whole website (only the exact pages AI cited), or proof that a page influenced an answer.
