# AI Biz Scanner — documentation guide
Version 0.2 • 22 October 2026

This pack specifies four self-service reports at launch, a free visibility sample and independent purchases. Agency packs come later. Subscription format and timing remain TBD; it may be a dashboard rather than recurring reports.

## Read in order
1. [Product brief](product/product-brief.md)
2. [Report catalog](product/report-catalog.md)
3. [User flows and rules](product/user-flows-and-rules.md)
4. [Website structure and SEO](product/website-structure-and-seo.md)
5. [Technical specification](engineering/technical-specification.md)
6. [Acceptance criteria](quality/acceptance-criteria.md)
7. [Build plan](planning/build-plan.md)
8. [Decision log](planning/decision-log.md)

## Instructions for implementation
Treat confirmed decisions as requirements, proposed defaults as configurable and open decisions as unresolved. Do not inherit old three-provider call counts, the old US$9 price, or the single expanded-report scope.

Launch coverage is ChatGPT/OpenAI, Claude/Anthropic, Gemini/Google and Perplexity via direct APIs. No OpenRouter, Google AI Overview collection or social-platform collection in this MVP. Validate models, search behavior, citations and costs before enabling paid coverage.

Keep business identity and competitor names out of unbranded discovery generation; supply them only afterward for matching. Named-brand analysis, explicit comparisons and generated ideas are separate task kinds. Never invent responses, citations, rankings, successful payments or reasons for omission.

All four report products must be launch-ready. Reuse the engine and evidence where compatible, without counting reused evidence as independent runs or silently delivering stale answers.

## Commercial and access rules
- Free sample and individually purchasable visibility, brand, competitor and location reports.
- Question review and approval before start/payment.
- No required account for individual reports under the existing rule; PDF and verified email delivery remain.
- Report-specific prices and limits, free question count, retention and bundle discounts are unresolved.
- Beta fee waivers remain, with bounded entitlements.
- Subscription is intended, but not specified or approved for charging yet.
- Agency packs, team/client access and marketplace/plugins are later work.

Public product pages and customer result pages serve different purposes: indexable marketing/sample pages versus private, non-indexed results. See the website specification.

Repository: [javoniehodge-code/aibizscanner](https://github.com/javoniehodge-code/aibizscanner).
These are specifications, not evidence of implementation, deployment, live charging or email sending.
