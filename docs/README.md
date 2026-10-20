# AI Visibility Checker — project starter pack
Version 0.1 • 20 October 2026 • Working name

## Purpose
Build an account-free utility that shows how a business appears in a defined sample of AI answers. Support local and online businesses, English and Spanish, a free check and a paid expanded report. API-based results are accepted. This is a product specification, not an implemented application.

## Read in order
1. [Product brief](product/product-brief.md)
2. [User flows and product rules](product/user-flows-and-rules.md)
3. [Technical specification](engineering/technical-specification.md)
4. [Acceptance criteria](quality/acceptance-criteria.md)
5. [Build plan](planning/build-plan.md)
6. [Decision log](planning/decision-log.md)

## Instructions for a coding agent
Implement in build-plan order. Begin with a real end-to-end scan, not the entire interface. Treat confirmed decisions as requirements and proposed defaults as editable configuration. Do not expand into daily monitoring, SEO content generation, a multi-model chat room, or account management.
Never invent provider responses, citation URLs, rankings, or successful payments. Label demo fixtures visibly and keep them out of production reports.
Keep original answers and test configuration as the evidence behind every result. Business context used to create questions must not leak into the discovery requests themselves.
Do not hard-code model names or assume a consumer chatbot and an API model behave identically. Verify current provider capabilities and pricing before implementation.
No production deployment, provider account setup, email sending, or payment configuration has been performed as part of these documents.

## Scope boundary
This pack specifies PDF generation as a product feature. It does not include a generated sample customer report.
Repository: [javoniehodge-code/aibizscanner](https://github.com/javoniehodge-code/aibizscanner). Documents are grouped by product, engineering, quality and planning. See the root README for recommended future source-code folders.

## Working commercial defaults
Free: one discovery question across three providers, one run each.
Paid: five discovery questions across three providers, three runs each, plus one recognition question per provider.
Proposed paid price: US$9 per report, subject to cost validation.
Beta: limited server-validated vouchers waive the fee for the same paid entitlement.
No subscription. No account. PDF download and verified email delivery for both tiers.

