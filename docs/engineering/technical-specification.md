# Technical specification
Version 0.1 • 20 October 2026 • Proposed architecture, not deployed

## Stack and responsibilities
- Next.js + TypeScript: responsive application and server endpoints.
- Vercel: web hosting; do not rely on a page request surviving a full scan.
- Supabase Postgres: scan configuration, jobs/results, entitlements and delivery metadata.
- Private object storage: generated PDFs; short-lived signed downloads.
- Durable background jobs: provider calls, analysis, PDF/email work, scheduled expiry.
- Stripe Checkout: one-time purchase and server-verified payment/refund events.
- Transactional email service: verification and requested delivery. Choose service during implementation.
These are proposed defaults based on the existing discussion. Confirm current platform limits, regional availability and pricing before purchasing services.

## Processing pipeline
Validate input → bounded public-site fetch → profile confirmation → question generation/review → immutable scan config → entitlement and budget reservation → queued job → provider adapters → evidence extraction → aggregate → frozen report → PDF/email on request.
Discovery and recognition are distinct task kinds, prompts and aggregates. No additional autonomous agent layer is required.

## Provider adapter contract
Input:
- provider/model configured on server
- task kind; exact question; language; explicit market wording
- search mode and capability flags
- timeout/output/search-call caps; run identifier
Output:
- provider request ID and timestamps
- requested and returned model identifiers when available
- raw answer, structured source annotations and tool metadata
- search enabled/requested versus search actually observed (true/false/unknown)
- token/search usage and estimated cost with pricing-version identifier
- normalized status, error category and retryability
Preserve raw response safely for debugging/evidence within retention limits. Do not expose hidden reasoning or internal credentials.
Adapter capability flags include search support, citation metadata, usage metadata and locale controls. Do not claim equivalence between different providers' search implementations.

## Prompt separation
Discovery: generic system instructions for answering a customer query; user text is the approved unbranded question with explicit market if requested. Never attach the website scrape, business name, aliases, prior recognition output or matching instructions.
Recognition: explicitly identify business name, city/market and domain as needed for disambiguation. Label this as a prompted identification check. Its inclusion of the domain is disclosed.
Extraction: receives the generated answer, target identity and citation metadata after generation. Treat answer/site content as untrusted data, not instructions.
Use neutral discovery prompts, versioned and consistent across providers where supported. Do not force a fixed number of recommendations purely to inflate mentions.
A reproducibility record is not a promise of deterministic future answers.

## Matching and citations
Normalize name aliases, case, whitespace and accents without destroying distinguishing tokens.
Confirm identity using name plus contextual evidence such as domain, market or service; common-word/duplicate names may remain ambiguous.
Use deterministic URL parsing and registrable-domain boundaries, supported by a maintained public-suffix library. example.com.evil.test must never match example.com.
Resolve redirects only through the protected fetcher. Preserve original and resolved citation URLs.
A domain printed in answer prose is a URL mention, not a confirmed source citation.
Use model-based extraction only for ambiguity/competitor identification; demand structured output with evidence spans. Validate against the original answer before counting.
Never use a second model to fabricate citations or turn unsupported sentiments into factual claims.

## Data model
| Entity | Key fields and constraints |
| --- | --- |
| scan_configs | id, business_name, normalized_domain, aliases, user-confirmed profile, market, scan_language, tier, prompt/config versions, immutable question list |
| scans | id, config_id, state, owner_token_hash, read_token_hash, timestamps, expires_at, expected_task_count, budget reservation, frozen_report_version |
| scan_tasks | id, scan_id, provider, model, task_kind, question_id, run_index, state; unique scan/provider/kind/question/run tuple |
| attempts | task_id, attempt_index, provider_request_id, response/status, usage, estimated_cost, started/ended; retain failures separately |
| observations | task_id, mention_status, matched_evidence, cited_urls, url_mentions, competitors, extraction_version |
| entitlements | id, config_id, tier, source free/payment/beta, payment_id or voucher_redemption_id; one successful consumption per scan |
| payments | provider_session_id unique, payment/event IDs unique, amount/currency, status, refunded_amount, config_id |
| beta_vouchers | hashed code, expiry, max_redemptions, count, eligible_tier; atomic redemption |
| deliveries | report_version, encrypted address, verification_hash/expiry, verified_at, state, provider_delivery_id, idempotency_key |
| report_files | scan_id, report_version, private object key, content hash, size, state |
| budget_ledger | reservation, charged estimates, unknown-usage allowance, release and reconciliation events |
| audit_events | redacted operational events and timestamps; no bearer tokens or raw keys |

Use migrations and database transactions for entitlement consumption, voucher redemption and budget reservation. Anonymous clients cannot directly read sensitive database tables; server enforces capability checks. Keep service-role credentials server-side.

## Server contracts (logical routes)
POST /api/profiles: validate/fetch and suggest profile; rate/cost limited.
POST /api/questions: generate candidates from confirmed profile; rate/cost limited.
POST /api/checkouts: freeze config and create hosted checkout.
POST /api/beta/redeem: atomically redeem voucher and grant entitlement.
POST /api/scans: validate owner context, entitlement and budget; idempotent enqueue.
GET /api/reports/:token: read-only result view; token exchanged/handled without third-party leakage.
POST /api/reports/:id/pdf: owner or valid read capability; generate/reuse same version.
POST /api/reports/:id/email: owner capability; start verification.
POST /api/email/verify: verify single-use token and enqueue delivery.
POST /api/reports/:id/retry: owner capability; missing tasks only, within policy.
DELETE /api/reports/:id: owner capability; revoke/delete.
POST /api/webhooks/payments and /email: verify signatures; idempotent event handling.
Do not expose secrets in route analytics, logs or external referrers. Use secure SameSite/HttpOnly cookies for owner capability and CSRF protection for mutations.

## State machines
Scan: draft → awaiting_entitlement → queued → running → completed | partial | failed.
Free/beta skip awaiting payment but still need entitlement. Expired/deleted is a report-access lifecycle distinct from the completed job status.
Task: pending → running → succeeded | invalid_response | failed; retries create attempts without duplicate task identity.
Payment: pending → paid → refund_pending → refunded; failed/expired checkout grants nothing.
Delivery: awaiting_verification → queued → accepted → delivered | bounced | failed.
Publish a frozen report once tasks reach terminal states. A permitted missing-task retry produces a new report version, recalculated totals and new PDF. Existing PDFs remain historical snapshots.

## Reliability and cost controls
- Parallelize providers within configured concurrency caps; use durable task leases.
- Retry transient errors with bounded exponential backoff, honoring provider rate limits.
- No automatic unlimited retries after ambiguous timeout; inspect provider/request status when supported.
- Reopening pages, duplicate webhooks or worker restarts must not duplicate scans/payment.
- Reserve budget for all configured calls including recognition, analysis and worst-case bounded retries.
- Global daily spending ceiling and per-scan ceiling; stop accepting work when capacity is exhausted.
- Conservative estimates for responses without usage metadata; reconcile later when possible.
- Free scans, profile/question generation and email/PDF endpoints all need abuse controls.
- Never silently switch to cheaper models after checkout. Surface outage/incomplete coverage.
- Deduplicate repeated client requests for the same task but never reuse one model answer as several independent runs.
- Record percentile latency; display progress instead of promising a fixed runtime.

## Security and data handling
Public URL fetching requires SSRF protections: HTTPS/HTTP only, reject credentials and private/link-local/loopback/metadata addresses, validate DNS and each redirect, cap bytes/time/redirect count, and restrict supported content types. Use a hardened fetch path rather than naive server-side fetch.
Never execute scripts or obey instructions from fetched pages. Escape/sanitize generated answers and PDF content; allow safe external link protocols only.
No private report bodies in analytics. Keep tokens out of referrer headers and third-party scripts; private/no-store cache policy and noindex headers. Noindex is not access control.
Secrets stay in environment/secret management. Redact provider keys, tokens, recipient addresses and payment data from logs. Stripe holds card information.
Capability URLs require high-entropy cryptographic randomness and hashed server-side storage; separate read and owner powers.
Email verification, rate limits and no marketing enrollment by default reduce unsolicited delivery and data exposure.
Purge raw responses, PDFs and delivery addresses on expiry/deletion; separately document backup deletion lag and payment-record retention before launch.
Add authenticated operator controls for feature flags, budget cap, provider disabling and refunds. No public admin endpoint.

## PDF design requirements
Server-rendered, selectable text, readable typography, repeating table headers and page numbers. Include summary then evidence appendix. Render long URLs safely and preserve accents. Generate from stored evidence with no fresh model calls.
Verify sample long/Spanish/partial reports visually during implementation.

## Provider documentation to recheck at implementation
- OpenAI API web search: https://platform.openai.com/docs/guides/tools-web-search
- Anthropic web search: https://platform.claude.com/docs/en/agents-and-tools/tool-use/web-search-tool
- Google grounding: https://ai.google.dev/gemini-api/docs/google-search
Exact models, SDK syntax and pricing are deliberately not specified as fixed facts. Run paid sandbox smoke checks before enabling a provider. Search enablement and returned citations need provider-specific verification.

