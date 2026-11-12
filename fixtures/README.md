# Report fixtures

| File | What it is |
| --- | --- |
| `report.schema.json` | JSON Schema for the report document, generated from the zod schema in `web/src/report/schema.ts` (`npm run report:schema` in `web/`). The zod schema also checks cross-references (evidence ids, businesses, cited pages, run counts) that JSON Schema can't express. |
| `brownstone.json` | Brownstone Movers, extracted from `design/reports/full-business-diagnostic.dc.html` as it was before the JSON refactor. Every value is `sample` (the design is sample data), except the Gemini local-business rule, which is a labeled `assumed` value. |
| `mvp-miami.json` | MVP Miami, extracted from `design/reports/full-business-diagnostic-mvp-miami.dc.html`. Claude answers and site checks are `observed` (evidence ids point at the export, 11 Nov 2026); ChatGPT, Gemini, Google and Yelp values stay `sample`. Things the older template never had are `missing` with a reason: `LOCAL` (localAssumption), `XSRC` (uncitedSources), `PA_N` (run counts), the raw-vs-loaded table, and one sentence that repeated Brownstone's page list. Nothing is copied from Brownstone. |

## Provenance

Every value sits inside exactly one envelope `{ "v": …, "p": … }`, placed at the smallest unit that comes from one
piece of evidence (an answer, a table row, a card). `p.kind` is:

- `observed`: seen in stored evidence; `p.evidence` lists ids from the document's `evidence` registry.
- `assumed`: a labeled assumption; `p.rule` states it.
- `sample`: illustrative data, not from a real run.
- `missing`: not available; `p.reason` says why and `v` is `null`. Only fields the template has a missing state for allow it.

## Regenerating

Fixtures are extracted mechanically (`npm run report:extract-fixtures` in `web/`): the legacy scripts run in a Node
sandbox with capture hooks on their data literals; text is read from their own render output. CI re-runs the
extraction and fails if the committed fixtures differ.

Counts the template can compute from the data (for example "4 of 5 facts" or answers citing a site) are not stored
twice. The run completeness counts (`promptAnalysis.run`) are stored as the run recorded them and cross-checked against the answers.
