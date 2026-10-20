# Product brief
Version 0.1 • 20 October 2026

## Problem and promise
Business owners want a quick answer to: “When people ask AI for a business like mine, does it mention me, link to my website, or recommend competitors?” Full monitoring suites may be more than they need. Existing free checkers mean simplicity alone is not a proven competitive advantage.

Promise: enter a business and website, approve realistic customer questions, and receive understandable evidence from multiple providers. Sell a bounded report, not a universal AI ranking or guaranteed improvement.

## Customers
Primary: owners and marketers at local service businesses and online businesses.
Secondary: consultants checking individual clients. Bulk agency management is outside v1.
Local business example: a dental practice serving San Juan.
Online business example: scheduling software targeting US small businesses.
Support optional market/location so online businesses are not forced into a city.

## Confirmed decisions
- Local and online businesses.
- Free and paid access; fees can be waived for beta users.
- No required account.
- Downloadable PDF and email delivery.
- API-based results; OpenAI, Anthropic and Google initially. Muse deferred until suitable access is verified.
- Approved workflow: identify business, review suggested questions, run scan, review evidence.
- English required; Spanish requested if straightforward. Adopt English and Spanish as the implementation default, subject to quality checks.

## Proposed defaults, not user-confirmed commercial promises
| Item | Default |
| --- | --- |
| Free sample | 1 discovery question × 3 providers × 1 run = 3 answers |
| Expanded report | 5 discovery questions × 3 providers × 3 runs = 45 discovery answers |
| Recognition in expanded report | 1 named-business question × 3 providers × 1 run = 3 additional answers |
| Price | US$9 one-time; configurable; validate economics before launch |
| Language | English or Spanish; one per scan |
| Report availability | 30 days after completion; disclose before starting |
| Free allowance | 1 scan per anonymous session per 24 hours, with additional abuse limits |
| Beta | Limited vouchers for expanded reports; no card required when fully waived |

A paid report therefore requires 48 answer calls, excluding question generation, analysis, retries and PDF/email work. Do not market it as costing only 45 calls. Upgrading creates a fresh complete expanded scan; do not mix old free answers into repeated-run counts.

## Three different outcomes
1. Discovery mention: an unbranded customer question produces a reference to the correct business.
2. Website citation: structured provider citation metadata points to the verified business domain or its subdomains.
3. Recognition: an explicitly named-business question produces a description of the correct business.
Recognition never contributes to discovery counts. Supplying a URL and asking for a summary is not a visibility test.

## MVP screens
Landing/input; business and question review; checkout or beta redemption; running scan; results; email verification/delivery confirmation; expired/unavailable report.
One report page contains overview counts, provider comparison, question breakdown, competitors, recognition when included, and expandable original answers/sources.
Include report date, language, target market and exact models. Lead with counts, not an opaque composite score.

## Languages
Internationalize UI strings, errors, emails and PDF templates from the outset. Generate questions in the selected scan language. Preserve original provider responses; do not silently translate evidence.
Switching UI language does not rerun or translate an existing scan. A scan in the other language is a new purchase/check under the applicable allowance.
Spanish adds copy review and QA, not a separate architecture. Planning allowance: roughly 1–3 development/QA days beyond an English-only version for this small scope, assuming a competent Spanish reviewer. Regional language quality still needs human review.

## Non-goals
Accounts, subscriptions, daily monitoring, automated SEO fixes, content publishing, public indexed reports, bulk agency tools, website ownership verification, search-volume estimates, competitive market-share claims, automatic bilingual comparisons, or exact consumer-app emulation.

## Metrics
Track setup completion, question edits, scan completion/partial failure, PDF downloads, verified email deliveries, free-to-paid conversion, beta-to-paid repeat purchases, costs per completed report and refund rate.
Report beta and paying cohorts separately. Do not count waived purchases as willingness to pay.
No claim of product-market fit from free scans alone.

## Economics and validation
All model usage uses the operator's API accounts. Users do not provide keys. Calculate:
revenue minus model/search costs, question generation, extraction, retries, PDF/email execution, payment fees and refunds.
Measure median and high-percentile report cost on representative businesses before setting the public price. Starting target: variable cost below 30% of price at the high percentile; a planning target, not a forecast.
Interview early users about whether the report helped a decision. Observe whether they pay to rerun or check another business.

## Public wording
“Your business appeared in 4 of 15 successful sampled answers.”
“API-based snapshot. Answers vary by question, model, date and search settings. Results may differ from the consumer apps.”
Avoid “40% of AI customers see you,” “your global AI rank,” or implied guarantees.

