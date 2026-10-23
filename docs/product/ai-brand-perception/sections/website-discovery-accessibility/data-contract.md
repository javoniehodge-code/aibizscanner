# Data contract: Website discovery and accessibility

Version 1 design handoff. Field names are proposed implementation names; the user-facing behavior in [the section specification](README.md) is approved.

## Report scope

| Field | Meaning |
| --- | --- |
| `section_id` | Stable `website-discovery-accessibility` identifier |
| `schema_version` | Version the stored format and interpretation |
| `is_illustrative` | Required true for the supplied fixture |
| `brand_name`, `domain` | Subject business and website |
| `display_date` | Date printed on the example, not proof of testing |
| `tested_at` | Actual execution time, null for this fixture |
| `total_site_pages` | Known inventory count; null if not established |
| `selected_page_count` | Must equal `selected_pages.length` |
| `selection_basis` | Why these pages support customer decisions |
| `selected_pages` | Named URLs, reasons and provider results |
| `missing_relevant_pages` | Desired decision pages not found by the site-discovery process; distinct from platform misses |
| `providers` | Search-access checks, routes, summaries and limitations |
| `findings` | Plain-language issues/options, affected page/provider IDs, evidence and uncertainty |

## Provider record

Stable ID and display name; exact test surface/tool and execution settings when real. `search_permission.status` is `allowed`, `blocked` or `unconfirmed`. Store the checked crawler, affected paths, observation, evidence and date. Null evidence/timestamps on samples cannot establish an actual test.

Keep optional verified crawler-visit and indexing records separate. Unknown support or lack of authorized logs is `unconfirmed`, not failed. Do not equate Google Search checks with all Gemini tools.

## Page record

Each has `id`, `title`, `url`, `why_selected` and a result for each provider. Preserve two outcomes:

- `search.status`: `found`, `not_found`, `not_tested`, `unconfirmed`.
- `reading.status`: `readable`, `partially_readable`, `unsuccessful`, `not_tested`, `unconfirmed`.

`not_found` is scoped to the recorded search test. `unsuccessful` is scoped to the recorded access attempt. Neither establishes a cause.

Also preserve owner-facing label, cause status/explanation, original responses, citations or tool events, expected content checks, execution timestamp and evidence IDs for real runs. If only some expected content is available, use partially readable instead of declaring the full page read.

## Counts

`found_and_read_count` counts selected pages where search is found and reading is readable. Denominator is always `selected_page_count`, never only the successful pages. A direct-link success without a search result is not counted as found-and-read but remains visible.

If all provider page tests are not_tested, `found_and_read_count` is null, and the summary reads Not tested rather than 0 of 6. Partial execution must show tested and untested counts explicitly. Null indexing/visit fields remain unknown rather than inferred from search results.

## Production evidence

Every real claim should link to dated evidence appropriate to its type: rules snapshot for published permissions; platform search output for discovery; tool-returned page content for reading; verified server logs for crawler visits; platform webmaster evidence for indexing where available. Use bounded source and page collection and disclose limits. Never let the illustrative fixture enter production results as observed evidence.

## Production implementation extension
See the [technical process](../../../../engineering/website-discovery-accessibility.md). Production checks also require exact provider/tool identifiers, attempted/observed search and fetch actions, URL-match evidence, content-validation evidence, cache/live/unknown retrieval provenance, per-attempt execution status and query/evaluation rule versions. Treat the sample fixture as a display example, not execution evidence. A cached content success can demonstrate information availability, but does not establish a current direct visit or verify removal of an access block.

