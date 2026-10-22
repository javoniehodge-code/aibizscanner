# AI Biz Scanner

Self-service AI visibility and brand reports for local and online businesses. Review customer questions, then inspect sampled recommendations, mentions, citations and competitor gaps.

**Status:** planning and specifications. Application implementation has not started.

## Launch scope
- Four individually purchasable reports: AI visibility, brand perception, competitor analysis and location comparison.
- A free visibility sample remains available.
- Direct OpenAI, Anthropic, Google Gemini and Perplexity API integrations; no OpenRouter.
- Google AI Overviews and ordinary Google search collection are outside this MVP. Gemini API coverage remains included.
- Customers review, edit and approve questions before starting a free scan or paying.
- English and Spanish, one language per scan; PDF download and verified email delivery.
- Preserve the account-free individual-report flow. Subscription access/account design remains open.
- Agency packs come later. A subscription is intended, but its dashboard/report format, timing, cadence and allowances are TBD.

See the [documentation guide](docs/README.md), [report catalog](docs/product/report-catalog.md), [website requirements](docs/product/website-structure-and-seo.md) and [decision log](docs/planning/decision-log.md).

API results are snapshots, not exact reproductions of consumer apps or universal rankings. Reports distinguish tested findings from generated discovery opportunities and improvement suggestions. Prices, question counts, repetitions, competitor/location caps and retention remain open launch decisions.

## Start development
Follow the [build plan](docs/planning/build-plan.md). Prove four-provider evidence collection first, then implement the shared engine and all four report products. Do not treat an intermediate visibility-only milestone as the complete launch.

## Recommended implementation folders
Create these when implementation begins; they are not scaffolded yet.

| Path | Purpose |
| --- | --- |
| src/app/ | Public product pages, private results and server routes |
| src/components/ | Shared interface components |
| src/lib/providers/ | Direct provider API adapters |
| src/lib/scans/ | Question preparation, execution and evidence extraction |
| src/lib/reports/ | Report assembly and PDF generation |
| src/lib/server/ | Database, payments, email and access helpers |
| src/jobs/ | Durable execution and delivery jobs |
| src/locales/ | English and Spanish messages |
| supabase/migrations/ | Versioned migrations |
| tests/ | Meaningful correctness and integration checks |
| public/ | Static public assets |

Keep credentials, customer reports and generated build artifacts out of Git.
