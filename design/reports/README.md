# Report designs (Claude Design exports)

| File | What it is |
| --- | --- |
| `full-business-diagnostic.dc.html` | **The report to build against.** Full Business Diagnostic, Brownstone Movers (sample data). Latest approved design. |
| `full-business-diagnostic-mvp-miami.dc.html` | Comparison copy for MVP Miami (mvpmiami.com). Claude answers and site checks are real (11 Nov 2026); ChatGPT, Gemini, Google and Yelp values are sample. Built before several template fixes; use as a second test fixture, not as the design reference. |
| `support.js` | Runtime the `.dc.html` files load (`./support.js`). Keep it next to them. |

## Viewing

Open a `.dc.html` file in a browser with internet access (it loads React and Babel from unpkg). Slides are navigated with the bar at the top.

## How the files are structured

Each file is one HTML template plus one logic script:

- Template holes: `{{ path }}`, `<sc-for list="{{ ... }}" as="x">`, `<sc-if value="{{ ... }}">`.
- `BRAND_PART`: website and web presence sections (`MS`, `TASKS`, `CASES`, `METHOD`, `CLEAR_ROWS`, and per-slide data built in `renderVals`).
- `PROMPT_PART`: AI prompt analysis (`TARGET`, `B` businesses, `PAGES` cited pages, `GROUPS`, `P` prompts and answers, `FC` first choices, `XSRC` sources named without a citation, `LOCAL` flag, coverage map, competitor comparison, web presence map rows).
- Host: `ORDER` (slide order), navigation, slide numbering.

All business data is currently written into these constants and into `renderVals` code. The build replaces them with a single report JSON (see [the build brief](../../docs/build/internal-testing-app.md)). Some static pieces remain, notably the two SVG "web" diagrams on the Credible slide, which must be generated from data.
