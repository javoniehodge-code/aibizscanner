# AI Biz Scanner

Self-service reports and ongoing monitoring showing how AI describes and recommends a business, where competitors appear and how results vary by location.

**Status:** planning and specifications; application implementation has not started.

## Current product scope
- Four paid reports: **AI Prompt Analysis**, **Brand Strength Analysis**, **Competitive Analysis**, **Location Analysis**.
- One free product: visibility report limited to **five customer-approved prompts**. No account or upfront email required; optional email delivery/signup follows results.
- **Account required for every paid purchase.** Checkout collects name, email and business details, with signup/sign-in before payment.
- One-time reports and timed report bundles, plus a subscription dashboard.
- Dashboard prompt checks **three times per week**. Brand, competitive and location analyses refresh more slowly; monthly versus twice monthly remains open.
- Direct OpenAI, Anthropic, Google Gemini and Perplexity APIs. No OpenRouter or Google AI Overview collection in the MVP.
- Imported business facts are owner-reviewed, separate from business priorities. Priorities suggest and order saved prompts; they never bias unbranded test payloads.
- Brand evidence uses green/yellow/red/gray statuses, detailed sources, practical actions and creative discovery ideas, not numeric grades.
- Evidence-linked checklists recheck issues, preserve completed history and reopen recurring discrepancies.
- Agency packs and integrations are separate later work. English/Spanish and PDF/verified email delivery carry forward.

Start with the [documentation guide](docs/README.md) and [Claude Design skeleton brief](docs/product/claude-design-skeleton.md).
See [report catalog](docs/product/report-catalog.md), [brand/checklist rules](docs/product/brand-evidence-and-checklist.md), [user flows](docs/product/user-flows-and-rules.md) and [decision log](docs/planning/decision-log.md).

Prices, paid prompt limits, repetitions, bundle terms, slower refresh cadence, retention and subscription release timing remain open. Do not invent them in designs or checkout.

## Implementation
Follow the [build plan](docs/planning/build-plan.md): validate four-provider evidence collection alongside design, then accounts, products, saved prompts, reports and monitoring. API tests are snapshots, not exact consumer app replicas or universal rankings.

Recommended source folders remain src/app, src/components, src/lib/providers, src/lib/scans, src/lib/reports, src/lib/server, src/jobs, src/locales, supabase/migrations, tests and public. They are not scaffolded yet.
Keep secrets, customer evidence and generated build artifacts out of Git.
