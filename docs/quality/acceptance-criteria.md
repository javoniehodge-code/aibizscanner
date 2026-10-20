# Acceptance criteria
Version 0.1 • 20 October 2026

Use deterministic fixtures for correctness and a small controlled live-provider batch for integration checks. Fixture data must be visibly synthetic in demos. Do not repeatedly spend on live tests without a concrete unresolved risk.

## Setup and questions
- [ ] Local and online businesses complete setup; location is optional.
- [ ] Bare domains normalize; invalid/private URLs are rejected before a network request.
- [ ] Blocked/unreadable websites offer manual profile entry.
- [ ] User can correct inferred category/location and edit candidate questions.
- [ ] Free selects one discovery question; paid confirms five.
- [ ] English and Spanish questions, UI, errors, PDF and email templates work.
- [ ] Existing scan language cannot change when only UI locale changes.
- [ ] Explicit target-name/domain discovery questions are flagged, with sensible handling of generic names.

## Test integrity
- [ ] Captured outbound discovery payloads contain no target profile, domain, aliases or recognition results beyond legitimately neutral customer wording.
- [ ] Each repeated run has a distinct request/attempt record and fresh conversation.
- [ ] All provider/model/search settings and prompts are saved.
- [ ] Search requested and search observed are distinct metadata fields.
- [ ] Recognition has separate tasks and totals.
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
- [ ] Free-to-paid upgrade creates a fresh 48-answer-task scan.
- [ ] All-failed paid scans trigger idempotent full refund.
- [ ] Partial paid scan offers bounded missing-task retry or refund under published policy.
- [ ] Cash refunds do not occur for waived reports.

## Reports, export and email
- [ ] Both tiers can download PDF without providing email.
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
3. Visually reviewed free, expanded, Spanish and partial PDFs.
4. Sandbox checkout, waiver, refund and verified email delivery.
5. Measured median/high-percentile cost and latency on a representative capped pilot.
6. Final price/retention/refund wording and configured operator budget cap.

