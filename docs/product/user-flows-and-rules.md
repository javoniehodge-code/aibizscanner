# User flows and product rules
Version 0.3 • 22 October 2026

## 1. Entry and product selection
Header: Products, Pricing, Sign up, Log in, Free visibility check. Public product pages contain sufficient explanation, examples, coverage, configured caps/price and purchase terms for a decision.
Four reports: AI Prompt Analysis, Brand Strength Analysis, Competitive Analysis, Location Analysis. Dashboard is a subscription product. Agency packs/integrations are separate later work.

## 2. Free visibility — guest flow
Business name/domain, language/category as needed, relevant location and optional competitors → review/edit/select five neutral prompts → approve/start → progress → results.
No upfront account or email is required. Results are not gated by email/signup. After results, offer requested email delivery or optional signup to save setup for returning use.
Only visibility is free; no free Brand Strength or paid report preview masquerading as a completed free product.
Normalize bare domains; reject invalid/private URLs before fetching. If extraction fails, offer manual profile entry. Show suggested facts for correction. A crawl failure is not low visibility.
Free allowance, repetitions and rate/cost limits remain open except for the fixed five-prompt cap.

## 3. Paid report — account-required flow
Product page → short checkout (name, email, business details) → create account or sign in → payment → finish report setup → approve questions/scope → scan → account-linked results.
These can be steps within one checkout; avoid duplicate entry. Sign-in reuses existing profile and business details with edit controls.
Account identity must be validated server-side before payment/entitlement creation. No guest purchase, including full beta waivers.
Before payment, show purchased product/version, caps, language/coverage, price, retention and failure policy. Final prompt choices can happen after payment within that purchased scope.
Do not silently upcharge if post-payment setup exceeds the package. Show the limit and let the customer revise; price-changing upgrades need explicit checkout.
If the customer leaves after payment, the order is visible as “Finish setup” in their account; resuming cannot charge twice.
Use verified payment events, not redirects, to grant entitlements. Check provider/capacity availability before charge where possible. Unstartable purchases follow disclosed refund policy.

## 4. Signup and baseline onboarding
Standalone signup, checkout signup and free-results conversion use the same progressive baseline workflow:
1. Name/email/authentication; method is a proposed implementation choice.
2. Import business name/domain/facts with source/date; approve, correct or leave unknown.
3. Locations if relevant and selected competitors.
4. Desired description, priority services/products, target customers/locations and goals.
5. Suggest/reuse prompts, let owner reorder/pin/edit and approve when starting tests.
Preserve imported observations alongside owner-confirmed corrections; differences create evidence-backed findings.
Keep desired positioning separate from facts. Explain priorities as input to question relevance/order, not a guarantee that AI will describe the business that way.
Save onboarding progress. Extra priorities need not block access to a purchased report if not required for its execution.
Attach a guest's existing free scan only with verified account/scan ownership; never claim reports solely because a typed email matches.

## 5. Prompt library and setup
Approved prompts belong to a business, with stable IDs, intent/category, priority, language, location/family and version. Default subsequent purchases/monitoring to the existing set.
Reordering/pinning does not change test wording/history. Adding or editing wording/language/location produces a version/series boundary; old reports remain frozen.
Visibility and location use neutral discovery prompts. Location requires two or more places and owner approval of each wording variant.
Brand is open-ended named-business assessment. Competitive Analysis applies the same framework to the target and up to four competitors; explicit comparisons never count as natural discovery.
Priorities guide candidate selection/order. Never send target profiles, desired positioning or named competitors in neutral discovery-generation context.
Freeze execution settings after final approval; disclose any new configuration rather than silently changing paid tests.

## 6. Scan and results
Direct OpenAI, Anthropic, Gemini and Perplexity calls; preserve actual models/search metadata, original answers and citations. Search requested versus observed is distinct. No OpenRouter/Google AI Overview in MVP.
Show real queued/running/completed/partial/failed states and successful/expected counts. Jobs survive tab closure and use bounded retries; provider failures do not stop other providers.
Results begin with executive summary and product-specific evidence. Labels distinguish recommendation, mention, ambiguity, absence, no business recommendation and missing answer.
Count substantive usable answers; exclude failures/refusals/empty responses. A substantive no-results answer can be valid. Preserve source metadata; prose URLs are not confirmed citations. Deduplicate citation frequency per answer while retaining originals.
Do not infer rank from list order, combine named-brand/discovery denominators or combine languages. Show counts with percentages and disclose small samples.
Brand/competitive results follow the [five-bucket rules](brand-evidence-and-checklist.md); observations, stated rationale and creative advice remain separate.

## 7. Checklist
Owner/source/AI discrepancies create stable evidence-linked tasks. Source fixes and AI-answer corrections are separate.
Task lifecycle, deduplication, verification and reopening follow [checklist rules](brand-evidence-and-checklist.md).
Owner marks done → awaiting verification; only a successful applicable check can verify. Non-verifiable ideas can be Owner completed, never falsely machine-verified.
Failed/unrelated checks cannot close tasks. Preserve completed history; recurring issues reopen.
One-off reruns and eligible monitoring refreshes recheck only the evidence they actually collect.

## 8. Monitoring and timed bundles
Dashboard requires an active subscription for ongoing monitoring, not just an account. Customers without subscription still access available purchased reports, unfinished orders and their business setup.
Prompt checks: three per week, fixed approved prompt versions and provider settings, dates visible. Exact weekdays/timezone, limits, missed-run/catch-up rules and alerts are open.
Brand/competitive/location refresh: monthly or twice monthly, not selected. Do not imply three full analyses weekly or real time.
Display module-specific last/next refresh and coverage. Plot actual values, gaps and labeled trends; annotate edits without claiming causation.
Timed report bundles are a separate purchase format; exact cadence, billing, cancellation and entitlement quantities must be specified before selling.
Cancellation/failed payment behavior and history access after subscription expiry are production launch decisions, not invented design promises.

## 9. Export, email and private access
PDF download available for free visibility and paid results, from frozen versions without new model calls. Preserve accents, long URLs, repeating headers and evidence.
Guest free results use high-entropy read/owner capabilities with browser recovery; unrelated guests cannot enumerate reports. Paid reports use account/business ownership checks. No public indexing.
Email is optional after free results and optional for paid report delivery. Verify guest addresses before sending evidence; an already verified account address can satisfy verification without a duplicate flow.
Pre-verification messages contain no report evidence. Reverification required for changed addresses; verification/delivery are bounded and idempotent. No automatic marketing enrollment.
Paid customer results are not public bearer links by default. Optional sharing must be separately designed with consent, revocation and read-only scope.
Expiry/deletion revokes access and removes evidence/files per configured policy; downloaded PDFs cannot be revoked. Retention, backup lag and payment/audit exceptions must be disclosed before sale.

## 10. Failure/refund proposals
Bounded missing-task retries, visible partial coverage, no duplicate charges. Proposed default: unresolved promised paid coverage permits retry or full refund; all-failed paid scans automatically refund. Waivers have no cash refund.
Delivery failures retry without rerunning AI. Final refund/retention rules require publication before charging.
Recurring-plan failures, credits, paused schedules and quota restoration need plan-specific rules before subscription/bundle charging.

## 11. Outside the current skeleton
Agency team/client management, live GBP editing, integration marketplace, Google AI Overviews and native social collection. Show integrations only as explicitly future material, not working controls.
