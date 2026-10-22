# Acceptance criteria
Version 0.3 • 22 October 2026

Use deterministic fixtures for correctness and a small controlled live-provider batch for integration checks. Fixture data must be visibly synthetic in demos. Do not repeatedly spend on live tests without a concrete unresolved risk.

## Setup and questions
- [ ] Local and online businesses complete setup; general-report market is optional and location comparison requires at least two places.
- [ ] Bare domains normalize; invalid/private URLs are rejected before a network request.
- [ ] Blocked/unreadable websites offer manual profile entry.
- [ ] User can correct inferred category/location and edit candidate questions.
- [ ] Free visibility selects five prompts; paid caps are disclosed; customers approve execution questions before scans, after payment for paid reports.
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
- [ ] Tab closure does not stop jobs; account recovery works for paid reports and original-browser capability recovery works for guest free reports.
- [ ] Duplicate submit or worker restart cannot create duplicate logical tasks.
- [ ] One provider outage yields partial results with correct denominators.
- [ ] Transient retries are bounded and count toward budget.
- [ ] Global spending cap is atomic under concurrent requests.
- [ ] Zero remaining capacity blocks new scans before payment where possible.
- [ ] Unknown-usage failures are conservatively budgeted.
- [ ] Unavailable required capability does not silently become a different model/test.

## Payments and beta
- [ ] Checkout requires an authenticated account and shows purchased scope, language/coverage, price, retention and incomplete-report policy; final questions may be selected afterward within caps.
- [ ] Redirect alone grants no entitlement; verified webhook does.
- [ ] Duplicate/out-of-order webhooks cannot duplicate scan/payment/refund.
- [ ] Expired or declined checkout cannot start a paid scan.
- [ ] Vouchers expire and cannot exceed redemption cap under concurrency.
- [ ] Full-waiver beta requires an account, no card and grants its disclosed eligible paid scope.
- [ ] Free-to-paid upgrade creates the purchased immutable task plan with fresh evidence; no fixed old 48-answer count or reused answer masquerading as a new run.
- [ ] All-failed paid scans trigger idempotent full refund.
- [ ] Partial paid scan offers bounded missing-task retry or refund under published policy.
- [ ] Cash refunds do not occur for waived reports.

## Reports, export and email
- [ ] Free visibility can download PDF without email; paid reports use account access without a separate delivery-email requirement.
- [ ] PDF counts and evidence match the exact frozen report version.
- [ ] Long answers, long URLs, Spanish accents and partial reports render without clipping.
- [ ] PDF failures retry without generating new AI answers.
- [ ] Verification messages contain no report evidence; guest free web results remain visible before optional email verification or signup.
- [ ] One-time verification expires; changed addresses require reverification.
- [ ] Duplicate verification/webhook/retry does not send repeated reports.
- [ ] Failed/bounced emails leave web report/PDF accessible.
- [ ] Oversized attachment falls back to an explained download link.
- [ ] No marketing subscription is created.
- [ ] Expiry is visible and PDFs disclose that they are historical snapshots.

## Access and safety
- [ ] Unrelated guests/accounts cannot enumerate reports or access another business's reports, tasks, profiles or private files.
- [ ] Guest free read capability cannot invoke owner-only email, retry or deletion; paid access uses authenticated ownership rather than public bearer links.
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
- [ ] All four reports are individually purchasable with accounts, without monitoring subscription; only five-prompt visibility is free to guests.
- [ ] Actual direct OpenAI, Anthropic, Google Gemini and Perplexity coverage is validated before selling four-provider reports.
- [ ] No OpenRouter or Google AI Overview collection is represented as MVP coverage.
- [ ] Product-specific task counts, price, approved questions, providers, repeats, competitors, locations and retention match checkout, entitlement and results.
- [ ] Missing required sections/tasks produce visible partial status; unavailable coverage is never silently replaced.
- [ ] Agency/integration features and undefined subscription/bundle terms are not offered for purchase.
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
- [ ] Competitive Analysis compares target plus up to four competitors using the same evidence framework, source coverage disclosure and separately labeled AI rationales; visibility retains the prompt appearance matrix.
- [ ] Location report compares matching question families/settings and exposes the exact wording/geographic settings for every cell.
- [ ] Location identity matching distinguishes branches/service areas and does not assume physical search location.
- [ ] Displayed claims about cited page contents require retrieved evidence, not only a URL.

## Public site and privacy
- [ ] Four report product pages plus a dashboard product page include useful readable HTML, scope, samples and actions; any unavailable dashboard plan is labeled rather than sold.
- [ ] Public metadata, canonical URLs, sitemap and robots settings match intended indexing.
- [ ] Structured data matches visible content; examples are labeled and do not invent customer ratings.
- [ ] Private reports, evidence/PDFs and capability URLs never enter public sitemaps, examples or analytics.
- [ ] noindex is tested in addition to access checks, not used as authentication.
- [ ] Dated adoption statistics retain source/definition; AI audience is not mislabeled as search volume.
- [ ] Keyboard/mobile flows and public initial HTML are reviewed.

Dashboard criteria below cover confirmed direction; unresolved plan/cadence/release decisions must be settled before activation. All four reports remain required for launch; agency packs remain later.

## Free, paid identity and onboarding
- [ ] No account/upfront email is needed for the five-prompt free visibility journey; results precede optional email/signup.
- [ ] No free Brand Strength product, guest paid checkout or anonymous beta paid entitlement is exposed.
- [ ] Checkout creates/signs into an account before payment and collects name/email/business without duplicate entry.
- [ ] Paid setup resumes after payment from the correct account with no duplicate charge; changes stay within purchased scope.
- [ ] Facts import with source/date, allow approve/correct/unknown and manual fallback; source history remains unchanged.
- [ ] Priorities/goals and desired description are separate from confirmed facts and never forced into discovery payloads.
- [ ] Ownership of both guest scan and account is verified before linking a free report; typed email matching is insufficient.
- [ ] Basic account can access purchased reports without an active monitoring subscription; unrelated business access is rejected.

## Saved prompts and priority
- [ ] Subsequent applicable products reuse the approved business question set by default.
- [ ] Pin/reorder changes display priority without splitting history or changing execution wording.
- [ ] New wording/language/location/provider settings create visible compatibility/version boundaries; frozen reports are immutable.
- [ ] Owner priorities influence candidate selection and emphasis without treating competitor priorities as owner goals.
- [ ] Location variants link to a common question family and disclose exact wording.

## Brand framework
- [ ] Five buckets are accessible business information, independent validation, customer review evidence, expertise/supporting evidence and information currency.
- [ ] Green/yellow/red/gray statuses include text/icons and documented criteria, rule version, checked scope and source excerpts/date.
- [ ] Could not assess and Not applicable are distinguishable; failed collection is not automatically red.
- [ ] No numeric/letter total, universal review threshold or mandatory original-research/schema/platform rule.
- [ ] Each AI's perspective remains distinct from source findings, advice and actual discovery tests.
- [ ] Competitor statuses use comparable criteria; coverage/rule changes are disclosed rather than misreported as business progress.

## Discrepancy checklist fixtures
- [ ] Owner-confirmed 7 p.m. hours preserve the website/AI 5 p.m. observations and create source/AI discrepancy items separately.
- [ ] Owner click moves a verifiable task to awaiting verification, not Verified complete.
- [ ] Successful website recheck can complete website task while AI discrepancy remains open.
- [ ] Failed/unrelated/missing-source checks cannot complete tasks; actual last checked and lifecycle events are separate.
- [ ] Repeated findings update a stable task rather than duplicating it or resetting its age.
- [ ] Completed history includes verification evidence/date; recurrence reopens with historical events intact.
- [ ] Strategic Owner completed status is not represented as machine-verified.
- [ ] New baseline or assessment rules do not silently complete tasks or rewrite history.
- [ ] Prompt-only refresh does not close a site/brand task without collecting the required evidence.
- [ ] Sampled AI correction is described within its configured verification scope, not as a universal resolution.

## Subscription and timed bundle release gates
- [ ] Monitoring schedules prompt checks three times weekly, not daily or real time.
- [ ] Brand/competitive/location modules use separately configured monthly or twice-monthly cadence after the choice is made, not each prompt refresh.
- [ ] Each module shows last/next refresh, sample counts, missing observations and compatible history.
- [ ] Graph uses actual observations and gaps; trend lines/annotations are labeled and don't imply causation.
- [ ] Scheduler restarts/webhook duplication do not double-run or double-consume credits; ownership and active entitlement are checked.
- [ ] Prices/caps, timezone/slots, cancellation/grace/catch-up, quota/credits, history and failure/refund terms are resolved before recurring charging.
- [ ] Timed bundles grant only their configured reports/cadence; dashboard access is not assumed.
- [ ] Subscription cancellation/renewal failure follows disclosed policy and prevents unentitled future jobs while preserving entitled account access.
