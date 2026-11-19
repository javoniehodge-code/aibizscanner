# Report designs (Claude Design exports)

| File | What it is |
| --- | --- |
| `full-business-diagnostic.dc.html` | **The report to build against.** Full Business Diagnostic, latest approved design. Renders only from a report JSON (`window.__REPORT__`); it contains no business data. |
| `full-business-diagnostic-mvp-miami.dc.html` | Comparison copy for MVP Miami (mvpmiami.com). Claude answers and site checks are real (11 Nov 2026); ChatGPT, Gemini, Google and Yelp values are sample. Built before several template fixes; use as a second test fixture, not as the design reference. |
| `support.js` | Runtime the `.dc.html` files load (`./support.js`). Keep it next to them. Unchanged. |
| `vendor/` | Pinned React 18.3.1, ReactDOM 18.3.1 and Babel standalone 7.29.0 (same files and SRI hashes `support.js` would fetch from unpkg). See `vendor/README.md`. |

## Viewing

- **The report:** in the app at `/reports` → *Load example reports* → *View report*. The app serves the template with
  the report JSON injected (`web/src/report/inject.ts`). Data: `fixtures/brownstone.json`, `fixtures/mvp-miami.json`.
- **The MVP Miami file:** open it in a browser with internet access (it still loads React and Babel from unpkg).

Slides are navigated with the bar at the top or the arrow keys.

## How the files are structured

Each file is one HTML template plus one logic script:

- Template holes: `{{ path }}`, `<sc-for list="{{ ... }}" as="x">`, `<sc-if value="{{ ... }}">`.
- `BRAND_PART`: website and web presence sections (`MS`, `TASKS`, `CASES`, `METHOD`, `CLEAR_ROWS`, and per-slide data built in `renderVals`).
- `PROMPT_PART`: AI prompt analysis (`TARGET`, `B` businesses, `PAGES` cited pages, `GROUPS`, `P` prompts and answers, `FC` first choices, `XSRC` sources named without a citation, `LOCAL` flag, coverage map, competitor comparison, web presence map rows).
- Host: `ORDER` (slide order), navigation, slide numbering.

In `full-business-diagnostic.dc.html` every one of these now reads from the report JSON (`R` in the script), whose
schema is `fixtures/report.schema.json` (zod source: `web/src/report/schema.ts`). The two SVG "web" diagrams on the
Credible slide are generated from data (`WEB` in the script). States kept: not found anywhere, ties, review scales
without 5 stars, sources named but not cited, the Gemini `LOCAL` assumption, unavailable answers, plus explicit
"not recorded for this report" states for data a report marks missing.

A report assembled by the pipeline (stage 12) contains only the sections whose stages have run. Sections it hasn't
produced are `null` in the JSON (`SECTIONS` in `web/src/report/schema.ts`), and the template leaves their slides out:
`NEEDS` in the script lists the sections each slide needs. Slide numbers, section numbers and the navigation follow
the slides that remain, and cover links to a missing slide read "Not in this report yet". With every section present
(both fixtures) the report is unchanged.

The original hand-filled version is in git history (commit `879241a`). `web/e2e/report-template.spec.ts` renders both
and requires identical text on all 24 slides and a pixel difference under 0.1%. `full-business-diagnostic-mvp-miami.dc.html`
is kept unchanged as the source of `fixtures/mvp-miami.json`.

**Businesses named slide (14 Nov 2026):** the Named and Recommended charts show the 15 businesses with the highest
counts, plus the report's business if it isn't among them; the "Explicit first choice" chart was removed (first
choices still show in the example answer). With more than 8 bars, names under the charts are slanted. The appearance
table lists the same top 15. The Brownstone pixel test skips this slide; the MVP Miami test checks it.

**Sources slide (16 Nov 2026):** the nine source-group tiles and the provider tabs are unchanged. Selecting a tile
lists that group's websites (only the pages that belong to the group), and a new "Websites cited" table lists every
website: answers citing it (a website counts once per answer, from the answers' citation keys) and distinct pages
cited; a row expands to its pages, their source groups and links that open the citing answers. Both follow the
selected provider tab. Answers show their original citation URLs (`citationUrls`). A report that lists pages but
links none to an answer shows the website answer count as unavailable.

**Citation coverage per service line (19 Nov 2026):** `citationCoverage` may be a list of maps, one per service line
(pipeline reports; each map has `line` with its name and questions). Each map is its own slide, labelled with the line,
counting only that line's answers. Columns keep the map's order (the business, then competitors by answers naming
them); with more than 8 columns, the first 8 are one table and the rest a second table below with the same rows and
column widths. The cited-pages table stays on the first coverage slide. A single map (both fixtures) renders as before.
