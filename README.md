# AI Biz Scanner

An account-free AI visibility checker for local and online businesses. Enter a business and website, review customer questions, and see sampled mentions, website citations, competitors and original answers across supported AI provider APIs.

**Status:** planning and specifications. Application implementation has not started.

## Documentation

Start with [the documentation guide](docs/README.md).

| Location | Contents |
| --- | --- |
| [docs/product/](docs/product/) | Product brief, user flows and product rules |
| [docs/engineering/](docs/engineering/) | Architecture, data model, provider integrations and security |
| [docs/quality/](docs/quality/) | Acceptance criteria and launch verification |
| [docs/planning/](docs/planning/) | Build phases and decision log |

## Initial scope

- Local and online businesses.
- Free sample and paid expanded report, with beta fee waivers.
- No required account; PDF download and verified email delivery.
- English and Spanish, one language per scan.
- OpenAI, Anthropic and Google API-based checks, subject to capability verification.

API results are snapshots, not exact reproductions of consumer chatbot sessions or universal business rankings. Proposed prices and limits remain provisional; see the [decision log](docs/planning/decision-log.md).

## Start development

Read the [build plan](docs/planning/build-plan.md) and implement Phase 1: one unbranded question, supported provider calls, stored answers/citations and a basic comparison. Validate the measurement before expanding the interface.

## Recommended implementation folders

Create these when implementation begins; they are not scaffolded yet.

| Path | Purpose |
| --- | --- |
| src/app/ | Next.js pages, layouts and server routes |
| src/components/ | Shared interface components |
| src/lib/providers/ | Provider API adapters |
| src/lib/scans/ | Prompt preparation, execution and result analysis |
| src/lib/reports/ | Report assembly and PDF generation |
| src/lib/server/ | Database, payments, email and server-only access helpers |
| src/jobs/ | Durable background scan and delivery jobs |
| src/locales/ | English and Spanish interface messages |
| supabase/migrations/ | Versioned database migrations |
| tests/ | Meaningful unit, integration and end-to-end tests |
| public/ | Static public assets |

Keep credentials, real customer reports and generated build artifacts out of Git. Add environment examples with placeholders when the application is scaffolded.
