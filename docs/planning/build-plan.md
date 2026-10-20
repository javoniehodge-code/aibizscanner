# Build plan
Version 0.1 • 20 October 2026

## Phase 1 — prove the measurement
Build one approved unbranded question sent to three real provider APIs with search support. Save original answers, citations, provider model IDs, usage and search metadata. Display confirmed name/domain observations in a plain result page.
Use a few known businesses and ambiguous-name fixtures. Verify actual tool behavior rather than assuming every model automatically searches.
Exit: real evidence across supported providers and measured cost per call. Disable unavailable provider until capability is proven.
Estimated effort: 2–3 developer days.

## Phase 2 — complete the core scan
Implement protected website fetch/manual fallback, profile confirmation, editable questions, scan-language selection, immutable configuration, background execution, safe matching, competitor extraction and separate recognition.
Add 3-answer free and 48-answer expanded configurations, frozen reports, anonymous owner/read capabilities, expiry and budget reservation.
Exit: complete and partial reports survive tab closure and worker retries; counts trace to evidence.
Estimated effort: 3–5 developer days.

## Phase 3 — make reports useful
Build the clean results interface, source/answer expansion, PDF export, verified email delivery, recovery and deletion. Add English/Spanish strings and template review. Implement accessibility basics: labels, keyboard controls, status announcements and mobile layout.
Exit: no-account flow works through both delivery routes; long/Spanish/partial exports visually checked.
Estimated effort: 2–4 developer days.

## Phase 4 — paid access and beta
Implement hosted one-time checkout, signed webhooks, atomic entitlement, beta vouchers, usage limits, refunds and operator controls.
Run all payment flows in sandbox first. Publish price, expiry and refund rules before turning on live charging.
Exit: duplicate events cannot duplicate work; beta grants paid scope without card; costs stay under cap.
Estimated effort: 2–3 developer days.

## Phase 5 — bounded pilot and launch gate
Run a small diverse pilot across local/online businesses and both languages. Review incorrect identity/citation matches, partial-failure behavior and costs.
Test with roughly 10–20 businesses as a planning target, not a statistical sample. Separate beta engagement from genuine paid demand.
Resolve release-blocking acceptance failures, configure monitoring and budget alerts, and verify deployment rollback.
Estimated effort: 2–4 developer days, plus time waiting for feedback.

## Timeline
Approximately 11–19 developer days, or about 3–4 focused weeks for one experienced developer using AI coding tools. This expands the prior simple MVP estimate to include paid checkout, PDF, email verification, dual language and reliable anonymous access. Provider/domain/payment setup delays and user-feedback waiting time are additional.
Spanish is integrated across phases rather than a separate rewrite. Its 1–3-day planning allowance is included in the upper range, not added twice.

## First coding task
“Read this starter pack. Implement Phase 1 only: one unbranded question, three provider adapters with web search where verified, original response/citation persistence and a simple comparison. Keep model IDs in config, add call-level usage logging and never include the target business identity in discovery payloads. Use fixtures when credentials are missing and label them visibly; do not claim live validation.”

## Setup required from the owner during implementation
- Repository is ready: javoniehodge-code/aibizscanner. Choose final branding and domain when ready.
- Provider API accounts and billing with explicit operator spending limits.
- Hosting/database/job service setup.
- Payment account configured for the operator's business and settlement location.
- Transactional email sender/domain verification.
- Final paid price and operational retention/refund policy before live charging.
These do not block starting a local prototype. Keep credentials in secret management, never in project docs or chat.

## Avoid premature expansion
No dashboard analytics product, recurring subscription, SEO article generator, model debate, public report feed or automatic rescan schedule.
Before adding a feature ask: does it improve report reliability, conversion, or learning from early users?

