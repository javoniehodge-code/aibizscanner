# Website structure and SEO requirements
Version 0.2 • 22 October 2026

## Purpose and boundary
Each report offering has a dedicated, useful public sales page. “A page for each report” means each report type, not automatically publishing customer results.
The following routes and content layout are proposed implementation defaults, not final branding. All four product pages and purchase journeys are launch scope.

| Proposed route | Purpose |
| --- | --- |
| / | Plain-English value proposition, example customer question and product overview |
| /reports | Compare all four reports, scope, samples and purchase links |
| /reports/ai-visibility | Mentions, recommendations, competitors and citations |
| /reports/brand-perception | Brand feedback, creative discovery opportunities and advice |
| /reports/competitor-analysis | Tested prompt gaps and citation comparisons |
| /reports/location-comparison | Results across explicit locations |
| /free-ai-visibility-check | Free scope, setup and next step |
| /pricing | Configured one-time prices and limits; no undefined subscription promises |
| /methodology | Sampling, task kinds, four-provider settings, gaps, limitations and failures |
| /samples/... | Synthetic labeled examples or separately authorized, sanitized examples |
| /learn/... | Useful explanations of AI discovery, customer situations and report interpretation |

Agency and subscription landing pages are later/TBD; do not advertise them as purchasable launch products. Avoid generating thin pages for every industry/city/provider combination.

## Product page content
Each page has a distinct title, heading, description and:
- Customer problem and plain-English explanation of what the report answers.
- Inputs, provider coverage, exact configured scope, price and turnaround expectations.
- Sample executive summary and five-question illustrative table where useful; examples are not product caps or live results.
- Differences from the other reports and links between relevant offerings.
- Original-evidence preview, limitations, report retention and incomplete-result policy.
- Useful FAQs and a clear purchase action without requiring a subscription.

Explain both category searches and customer situations, such as a café for laptop work or a plumber after a failed DIY repair. Introduce AEO only after the practical use is understandable.
Audience/adoption statistics must have an identifiable primary source, date, geography and definition. Do not describe AI user counts as business-search volume or Google keyword volumes as AI prompt popularity.
A report's advice does not guarantee recommendation placement.

## Technical requirements
- Public content and navigation available as readable HTML through static/server rendering, with real crawlable links and stable URLs.
- Unique metadata, canonical URLs, meaningful headings, accessible layout and mobile usability.
- XML sitemap containing canonical indexable public pages only; intentional robots rules and no accidental production noindex.
- Structured data accurate to visible content and supported page/entity types; do not invent ratings, reviews or business facts.
- Correct status codes and redirects, no duplicate query-string copies of product pages, monitored broken links.
- English/Spanish URL and canonical/hreflang policy when translated public pages ship; UI locale alone must not create duplicate indexable URLs.
- Review initial HTML and rendered page, metadata, sitemap, robots behavior and keyboard/mobile usability before launch.

AI discovery builds on accessible, clear, sourceable content; no claim of special schema or guaranteed inclusion. llms.txt, schema generators and crawler-checker products are separate backlog ideas, not hidden launch requirements.

## Customer privacy
Individual results and PDF evidence remain private by default under the capability-access rules. Use noindex and private/no-store headers; never treat robots.txt/noindex as authentication.
Exclude private results and capability URLs from public links, analytics, sitemaps and samples. Optional read-link sharing carries existing bearer-link disclosure; it does not authorize public indexing.

## Reference guidance
Recheck official guidance during implementation:
- https://developers.google.com/search/docs/appearance/ai-features
- https://developers.google.com/search/docs/fundamentals/seo-starter-guide
