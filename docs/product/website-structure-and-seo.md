# Website structure and SEO requirements
Version 0.3 • 22 October 2026

## Public page structure
Products is the navigation label. Four paid report types and a subscription dashboard each have a dedicated useful public page. Only visibility has a free five-prompt version.
Routes below are proposed; branding/slugs may change before implementation.

| Route | Purpose |
| --- | --- |
| / | Narrative homepage connecting business questions to products |
| /products | Product overview |
| /products/ai-prompt-analysis | Prompt visibility, competitors and citations |
| /products/brand-strength | AI perspectives, five evidence buckets and actions |
| /products/competitive-analysis | Target plus up to four competitors, comparative assessment |
| /products/location-analysis | Matched visibility questions across places |
| /products/dashboard | Subscription monitoring: prompts three times weekly and slower analyses |
| /free-ai-visibility-check | Five-prompt guest workflow, results before optional email/signup |
| /pricing | One-off, timed report bundles and subscription terms once configured |
| /signup and /login | Account entry, kept out of search indexing |
| /methodology | Sampling, evidence statuses, sources, limitations and cadence |
| /samples/... | Labeled synthetic or separately authorized sanitized examples |
| /learn/... | Useful explanations and customer-situation examples |
| /privacy, /terms, /help | Supporting policies/help, text to prepare |

Account workspace uses separate private /app/... routes. Route names are proposed; do not duplicate public product copy in private result routes.

## Homepage narrative
Promise → understand your brand → test recommendations → learn from competitors → explore geographic gaps → track changes → choose a starting point.
Every section includes plain-English benefit, small illustrative output and relevant product action. Product pages provide enough scope/sample/price information for purchase before detailed question setup.
Primary free CTA; paid products remain directly purchasable with account creation/sign-in at checkout. No free Brand Strength, guest checkout or daily/real-time monitoring promise.

## Product page requirements
Distinct title, heading, description, audience/problem, inputs, outputs, configured AI coverage/caps/price, useful sample, FAQs and action.
Explain differences: visibility appearances; brand perspectives/evidence; competitive five-bucket comparison; geographic comparison; monitoring history/checklist.
Report purchases do not require a subscription. Timed bundles and dashboard subscription are distinct purchase formats; do not sell undefined plans. Dashboard release timing remains open.
Display accurate cadence per module. No implied automatic causal proof that an edit increased visibility.

## Discoverability and quality
Public content/navigation must be readable in initial HTML via static/server rendering with stable crawlable links. Unique metadata, canonicals, sitemap and intentional robots settings; structured data matches visible content.
Use semantic headings, accessible status labels, mobile layouts, appropriate status codes and redirects. Avoid thin location/industry/provider pages.
English/Spanish public-page policy must define translated URLs, canonicals and language alternates; UI locale alone must not create duplicate indexed URLs.
Examples/statistics must be labeled and sourced with dates/definitions. Do not invent testimonials or relabel AI audience as search volume.
No special-schema or llms.txt recommendation guarantee; these are not prerequisites in our framework.

## Privacy and indexing
Public offering pages are distinct from private evidence. Keep auth, checkout, onboarding, account workspace, report bodies, PDFs, capabilities and API routes out of sitemaps/search indexing.
Use account ownership checks for paid evidence and secure capabilities for guest free evidence, plus noindex/private cache policies. noindex is not authentication.
Do not expose a guest scan publicly because it is free. Optional email delivery and account creation require consent/verification; no marketing enrollment by default.
Agency/integration pages are not assumed launch products; no live GBP management claims.

## References to recheck during implementation
- https://developers.google.com/search/docs/appearance/ai-features
- https://developers.google.com/search/docs/fundamentals/seo-starter-guide

For the prototype, use [Claude Design brief](claude-design-skeleton.md); validate initial HTML/metadata/sitemap and private route exclusion during implementation.
