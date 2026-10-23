# Decision log
Version 0.3 • 22 October 2026

Confirmed = explicit user decision; Proposed = implementation/design default; Open/launch gate = resolve before selling the affected scope; Later = outside current launch.
Version 0.3 supersedes conflicting earlier 20/22 October rules.

## Current decisions
| Decision | Status | Effect |
| --- | --- | --- |
| Local and online businesses | Confirmed | No forced local-only model |
| Four paid reports: AI Prompt Analysis, Brand Strength Analysis, Competitive Analysis, Location Analysis | Confirmed | Competitive Analysis restored by later written product outline; distinct comparative five-bucket assessment |
| Visibility competitors | Confirmed | Show who appears where in approved prompts |
| Brand perspective | Confirmed | Open-ended AI assessment of recommendation situations/concerns, sources, advice and creative opportunities |
| Competitive report | Confirmed | Target plus up to four competitors, comparable evidence buckets and stated rationales |
| Five brand buckets with green/yellow/red/gray statuses, evidence and steps | Confirmed | No grades/100-point total; rule details must be specified |
| Free visibility only, five prompts | Confirmed | No free Brand Strength |
| Free results before optional email/signup | Confirmed latest flow | No upfront account/email or results gate |
| Every paid purchase requires account | Confirmed latest flow | Guest paid purchases withdrawn |
| Short checkout name/email/business, signup/sign-in, payment, then remaining setup/question approval | Confirmed | Question approval before scan, not before payment |
| Signup facts import/owner approval separately from priorities/goals | Confirmed | Preserve source observations/corrections |
| Priorities drive suggestions/order of reusable saved prompts | Confirmed | Reorder retains history; wording/version changes visible |
| Dashboard subscription | Confirmed direction | Account ownership alone does not include monitoring |
| Prompt monitoring three times weekly | Confirmed | Replaces daily/real-time claims |
| Brand/competitive/location refresh monthly or twice monthly | Direction confirmed; exact choice open | Separate slower module cadence |
| One-off and timed report bundles | Confirmed direction | Exact cadence/quantity/billing terms open |
| Evidence-linked discrepancy checklist | Confirmed | Recheck applicable evidence; owner action not automatic verification |
| Website fix separate from AI discrepancy | Confirmed | Owner-confirmed baseline does not rewrite observed sources |
| Task completion history and recurrence | Confirmed | Successful applicable verification, no closure from failed/absent summary; reopen recurring issue |
| Products navigation and dedicated public product pages | Confirmed | Homepage explains customer benefit, not just tools |
| Four direct provider APIs: OpenAI, Anthropic, Gemini, Perplexity | Confirmed | No OpenRouter; no Google AI Overviews in MVP |
| PDF/verified email, bounded beta waivers | Carried forward | Accounts required for paid/waived scope; free email optional |
| English and Spanish | Implementation default carried forward | One scan language; quality validation required |
| Agency packs and integrations | Later / separate priority list | GBP is a candidate, not an approved live integration |
| Next.js/Vercel/Supabase/auth/Stripe implementation | Proposed | Not deployed; exact service configuration not confirmed |
| Fifty monitored prompts | Illustration only | Not a confirmed plan limit |

## Open decisions
Paid prices/caps/repetitions; free repetitions/rate allowance; subscription/bundle terms, allowances, cancellation and release timing; monthly vs twice-monthly full cadence; exact weekly schedule/timezone/catch-up; status/checklist materiality/stability/aggregation rules; retention/refund/account-deletion policies; authentication details; final brand/domain.
All relevant commercial and production verification details are release gates, not reasons to block the design skeleton.

## Superseded history
- 20 October starter: three providers, single expanded report, account-free purchases, proposed US$9 and 30 days. Replaced; old 3/48-answer counts are not current.
- Earlier 22 October: four reports, subscription unspecified, one free prompt count TBD and no required account; later competitor report was briefly proposed for removal. Latest written outline restores four reports with a distinct comparative assessment.
- Earlier email-before-free-scan and mandatory paid accounts were temporarily replaced with free email-after-results and optional guest paid orders. Latest decision restores mandatory accounts for all paid purchases while retaining guest free visibility.
- Free Brand Strength was proposed in the written outline, then explicitly withdrawn.
- Numeric/letter grades replaced by five status buckets with source evidence and criteria.
- Daily monitoring replaced by prompting three times weekly and slower full analysis refresh.
- “Compare reports” / Reports header is replaced by Products.
- Approval before payment is replaced by approval before execution within paid package scope.
- Blanket exclusion of account/dashboard work is no longer current. Dashboard is in design scope; exact release/plan details remain open.
- Agency, integration marketplace and Google AI Overview collection remain outside MVP.

## Maintenance
Update catalog, flows, design map, architecture and acceptance together. Keep source observations, owner assertions, desired positioning, named-brand opinions and actual discovery tests distinct.
Do not infer confirmation of prices, schedule details or implementation defaults from these specifications.

## Confirmed section decision — 23 October 2026
- Brand Strength is now the **AI Brand Perception Audit**. The report is being refined in chunks.
- Section 1 assesses discovery and accessibility of the business’s own website for ChatGPT, Claude, Gemini and Perplexity.
- Show exact selected page names, clickable URLs, selection reasons and one consistent denominator; do not confuse selected pages with total website size. Six pages is sample data only.
- Published search permissions and observed page discovery/reading are separate. Blocked, unconfirmed and not tested are distinct. Report confirmed restrictions plainly; the owner chooses what to do.
- Use plain English, a white background and all-black text. Put technical details behind expandable controls. Webpage first; PDF layout later.
- The Café Bustelo design is approved as a reference; all displayed test outcomes are simulated and must remain labeled.
- [Approved specification, visual and data](../product/ai-brand-perception/sections/website-discovery-accessibility/README.md). This update covers the first section only; it does not endorse older whole-report examples as the current design.

## Confirmed second-section decision — 23 October 2026
- Section 2, **Clear & complete**, asks whether the website gives AI clear, concise and complete facts to match a product to a customer's needs.
- Assess relevant recommendation decisions against versioned industry standards, not merely the presence of a product name or an About page fact.
- The approved coffee example has eight questions across the same six selected pages, with illustrative counts of 4 enough detail, 2 some detail missing and 2 not enough information.
- This is our website-content baseline, not per-model opinions or proof of an AI recommendation. Missing, unavailable and not applicable are distinct.
- Preserve the white background, all-black text, plain language, explicit scope and expandable evidence. Owner onboarding collects optional facts, not desired positioning.
- [Approved reference and data](../product/ai-brand-perception/sections/clear-concise-complete/README.md); [proposed technical process](../engineering/clear-concise-complete.md). This approval does not finalize other report sections or deploy a scanner.

