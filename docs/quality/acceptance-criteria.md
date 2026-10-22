# Acceptance criteria
Version 0.2 • 22 October 2026

Use deterministic fixtures for correctness and a small controlled live-provider batch for integration checks. Fixture data must be visibly synthetic in demos. Do not repeatedly spend on live tests without a concrete unresolved risk.

## Setup and questions
- [ ] Local and online businesses complete setup; general-report market is optional and location comparison requires at least two places.
- [ ] Bare domains normalize; invalid/private URLs are rejected before a network request.
- [ ] Blocked/unreadable websites offer manual profile entry.
- [ ] User can correct inferred category/location and edit candidate questions.
- [ ] Free and each paid report use disclosed configurable caps; customers select/edit/approve questions before free start or payment.
- [ ] English and Spanish questions, UI, errors, PDF and email templates work.
- [ ] Existing scan language cannot change when only UI locale changes.
- [ ] Explicit target-name/domain discovery questions are flagged, with sensible handling of generic names.

## Test integrity
- [ ] Captured outbound discovery payloads contain no target profile, domain, aliases or recognition results beyond legitimately neutral customer wording.
- [ ] Each repeated run has a distinct request/attempt record and fresh conversation.
- [ ] All provider/model/search settings and prompts are saved.
- [ ] Search requested and search observed are distinct metadata fields.
- [ ] Named-brand analysis has separate tasks and totals from discovery.
- [ ] Changing a prompt/config creates a new scan; it cannot alter paid configuration silently.

## Analysis fixtures
- [ ] Correct business mention is counted once per answer.
- [ ] Same-name business in another city is not automatically counted.
- [ ] Generic-word brand and uncertain entity resolve to ambiguous when appropriate.
- [ ] Domain in answer prose is not treated as a structured citation.
- [ ] Valid owned subdomain citations count; lookalike suffix/substring domains do not.
- [ ] Duplicate links count once in headline answer totals but remain in evidence.
- [ ] Competitor names require evidence in the answer and deduplicate within it.
- [ ] Refusal/empty/error responses are excluded with visible status.
- [ ] Substantive no-results answers remain valid zero mentions.
- [ ] Headline denominators equal the visible valid discovery answers.
- [ ] No inferred customer traffic, fabricated rank or unsupported sentiment claims.

## Jobs and costs
- [ ] Tab closure does not stop the job; original-browser recovery works.
- [ ] Duplicate submit or worker restart cannot create duplicate logical tasks.
- [ ] One provider outage yields partial results with correct denominators.
- [ ] Transient retries are bounded and count toward budget.
- [ ] Global spending cap is atomic under concurrent requests.
- [ ] Zero remaining capacity blocks new scans before payment where possible.
- [ ] Unknown-usage failures are conservatively budgeted.
- [ ] Unavailable required capability does not silently become a different model/test.

## Payments and beta
- [ ] Checkout shows scope, language, price, retention and incomplete-report policy.
- [ ] Redirect alone grants no entitlement; verified webhook does.
- [ ] Duplicate/out-of-order webhooks cannot duplicate scan/payment/refund.
- [ ] Expired or declined checkout cannot start a paid scan.
- [ ] Vouchers expire and cannot exceed redemption cap under concurrency.
- [ ] Full-waiver beta requires no card and grants the same paid scope.
- [ ] Free-to-paid upgrade creates the purchased immutable task plan with fresh evidence; no fixed old 48-answer count or reused answer masquerading as a new run.
- [ ] All-failed paid scans trigger idempotent full refund.
- [ ] Partial paid scan offers bounded missing-task retry or refund under published policy.
- [ ] Cash refunds do not occur for waived reports.

## Reports, export and email
- [ ] Free and all four paid report types can download PDF without providing email.
- [ ] PDF counts and evidence match the exact frozen report version.
- [ ] Long answers, long URLs, Spanish accents and partial reports render without clipping.
- [ ] PDF failures retry without generating new AI answers.
- [ ] Email verification reveals no business evidence before verification.
- [ ] One-time verification expires; changed addresses require reverification.
- [ ] Duplicate verification/webhook/retry does not send repeated reports.
- [ ] Failed/bounced emails leave web report/PDF accessible.
- [ ] Oversized attachment falls back to an explained download link.
- [ ] No marketing subscription is created.
- [ ] Expiry is visible and PDFs disclose that they are historical snapshots.

## Access and safety
- [ ] Anonymous unrelated visitor cannot enumerate reports or read database rows.
- [ ] Read token cannot invoke owner-only email, retry or deletion actions.
- [ ] Revoked/expired tokens fail; report files cannot be downloaded via public object paths.
- [ ] No secrets/tokens appear in logs, analytics or referrer leakage.
- [ ] SSRF tests cover localhost, private IPv4/IPv6, redirect-to-private and metadata endpoints.
- [ ] Malicious website instructions do not change scan prompt policy.
- [ ] Generated HTML/script and unsafe links cannot execute in web/PDF views.
- [ ] Deletion/expiry job removes intended evidence and files without deleting required payment audit records.

## Launch evidence
A compact release checklist must link to:
1. One end-to-end real scan per provider showing search/citation capability.
2. Fixture results for matching, counting, retries, access and payment idempotency.
3. Visually reviewed free and all four paid report PDFs, including Spanish, long and partial examples.
4. Sandbox checkout, waiver, refund and verified email delivery.
5. Measured median/high-percentile cost and latency on a representative capped pilot.
6. Final per-report prices, caps, retention/refund wording and configured operator budget cap.


## Launch catalog and provider coverage
- [ ] All four reports are selectable and individually purchasable without subscription; free visibility remains available.
- [ ] Actual direct OpenAI, Anthropic, Google Gemini and Perplexity coverage is validated before selling four-provider reports.
- [ ] No OpenRouter or Google AI Overview collection is represented as MVP coverage.
- [ ] Product-specific task counts, price, approved questions, providers, repeats, competitors, locations and retention match checkout, entitlement and results.
- [ ] Missing required sections/tasks produce visible partial status; unavailable coverage is never silently replaced.
- [ ] Agency packs and undefined subscription features are not offered for purchase.
- [ ] Shared evidence retains collection date and counts once; an unpaid report type is not exposed by shared storage.

## Report-specific correctness
- [ ] Visibility shows target and competitor mentions/recommendations and top cited websites/pages with inspectable counts.
- [ ] Recommendation classifications distinguish negative references, mentions, ambiguity and actual recommendations.
- [ ] Competitor gaps derive from successful, unambiguous answers; absence is described as sample absence, not permanent exclusion.
- [ ] Brand descriptions and stated strengths/concerns link to original excerpts and available sources.
- [ ] Named-brand suitability feedback never contributes to unbranded discovery counts.
- [ ] Creative customer situations and suggested prompts are labeled as ideas, not measured popularity or executed tests.
- [ ] Advice cites supporting findings where available and identifies assumptions; no invented services or causal claims about omissions.
- [ ] Selecting an idea for testing creates a newly approved configuration under disclosed allowance/purchase rules.
- [ ] Informational/DIY answers with no recommendations are identified separately; useful citations remain visible.
- [ ] Competitor report shows tested prompts with and without recommendations for each selected business, plus source comparisons.
- [ ] Location report compares matching question families/settings and exposes the exact wording/geographic settings for every cell.
- [ ] Location identity matching distinguishes branches/service areas and does not assume physical search location.
- [ ] Displayed claims about cited page contents require retrieved evidence, not only a URL.

## Public site and privacy
- [ ] Four distinct public product pages include useful readable HTML, scope, samples, FAQs and purchase links.
- [ ] Public metadata, canonical URLs, sitemap and robots settings match intended indexing.
- [ ] Structured data matches visible content; examples are labeled and do not invent customer ratings.
- [ ] Private reports, evidence/PDFs and capability URLs never enter public sitemaps, examples or analytics.
- [ ] noindex is tested in addition to access checks, not used as authentication.
- [ ] Dated adoption statistics retain source/definition; AI audience is not mislabeled as search volume.
- [ ] Keyboard/mobile flows and public initial HTML are reviewed.

Subscription/dashboard and agency acceptance criteria must be specified once those products are decided. Their absence does not reduce the requirement to launch all four individual reports.
