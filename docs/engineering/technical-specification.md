# Technical specification
Version 0.3 • 22 October 2026 • Proposed architecture, not deployed

## Stack and responsibilities
Proposed defaults, not deployed:
- Next.js + TypeScript for public server-rendered pages, account workspace and server routes.
- Vercel for web hosting; durable workers for long/scheduled jobs rather than long page requests.
- Supabase Postgres, private object storage and an authenticated identity provider (Supabase Auth is proposed).
- Stripe Checkout for account-bound one-off and recurring payments, enabled only after the applicable plan terms are resolved.
- Transactional email for account verification/recovery and requested report delivery.
Validate current platform limits/pricing during implementation. [Design skeleton](../product/claude-design-skeleton.md) uses mock data and no live side effects.

## Processing pipeline
Free: protected profile fetch/manual fallback → five approved prompts → allowance/budget reservation → immutable config → queued tasks → evidence → frozen report → optional email/signup.
Paid: product selection → account creation/sign-in and checkout details → purchased scope/order + verified payment → resumable setup/baseline → approved immutable execution config → entitlement/budget reservation → execution → frozen report/checklist.
Payment fixes the product/version, price and package envelope; final prompts are approved afterward within those caps. Never attach arbitrary higher-cost work to the paid order or auto-charge changes.
Scheduled: active subscription/bundle → due slot with unique identity → entitlement/quota and spending check → approved config snapshot → durable execution → dated observations/relevant checklist rechecks.
Four direct adapters: OpenAI, Anthropic, Google Gemini, Perplexity. No OpenRouter or Google AI Overview collection.
Separate discovery, named-brand perspectives, explicit comparison, evidence assessment, opportunities and advice. Only discovery results enter discovery totals. Generation/analysis/checklist rechecks have declared budgets and provenance.

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
Named-brand analysis: explicitly identify business name, city/market and domain as needed for disambiguation. Label as prompted brand feedback, not unbranded discovery. Its inclusion of the domain is disclosed.
Explicit brand comparisons also remain outside discovery aggregates.
Opportunity/advice generation: may receive profile and captured evidence to suggest new situations or improvements. Store suggestion kind, supporting observation IDs/excerpts, assumptions and generation version. Never count generated prompts as executed tests.
Location tasks use approved common question families, explicit location variants and per-provider geographic metadata where supported. Keep locations separate in results and record branch/service-area matching.
Extraction: receives the generated answer, target identity and citation metadata after generation. Treat answer/site content as untrusted data, not instructions.
Use neutral discovery prompts, versioned and consistent across providers where supported. Do not force a fixed number of recommendations purely to inflate mentions.
A reproducibility record is not a promise of deterministic future answers.

## Matching and citations
Normalize name aliases, case, whitespace and accents without destroying distinguishing tokens.
Confirm identity using name plus contextual evidence such as domain, market or service; common-word/duplicate names may remain ambiguous.
Use deterministic URL parsing and registrable-domain boundaries, supported by a maintained public-suffix library. example.com.evil.test must never match example.com.
Resolve redirects only through the protected fetcher. Preserve original and resolved citation URLs.
A domain printed in answer prose is a URL mention, not a confirmed source citation.
Use model-based extraction only where interpretation is needed, including identity ambiguity, recommendation classification, competitor identification and brand claims; demand structured output with evidence spans. Validate against the original answer before counting.
Never use a second model to fabricate citations or turn unsupported sentiments into factual claims.

## Data model
Proposed entities; actual migrations follow these invariants.

| Entity | Important fields/constraints |
| --- | --- |
| accounts/businesses | authenticated owner_id, business identity; server-side per-business access; no agency roles implied |
| onboarding_progress | account/business, completed steps, resumable state |
| source_observations | business, claim key, observed value, URL/excerpt, collected_at, fetch status; immutable historical evidence |
| business_fact_versions | business/claim, owner-confirmed value, attribution, approved/effective timestamps, source references |
| business_priorities | desired positioning, priority services/products, locations, customer needs and goals; separate from facts |
| question_families/question_versions | stable question/family ID, exact wording/version, intent, language/location and approval; old versions immutable |
| question_set_versions | business, approved membership/version; mutable display order/pin priority recorded separately |
| report_products | versioned product scope, price/currency, caps/providers/task kinds, retention/failure policy |
| orders/payments | owner/business/product, purchased scope snapshot, setup state; unique provider session/payment/event IDs; execution config linked when approved |
| entitlements | account/order/plan, scope, period/credits, consumption/reservation; no double use under concurrency |
| plans/subscriptions | versioned scope and billing terms, provider IDs, state/periods; only enabled after plan decisions |
| schedules/schedule_slots | module/cadence/timezone/approved config, due slot, unique schedule+slot key; no duplicate execution after restarts |
| scan_configs | business, report type, approved profile/question versions, competitor IDs, locations, provider/model/search configuration and repetitions |
| scans/scan_tasks/attempts | immutable config, job state, expected counts, budget; unique provider/kind/question/location/run task; distinct attempts |
| observations | task, matched identity/excerpt, mention/recommendation/ambiguity, citations/URL mentions, extraction version |
| evidence_assessments | business/competitor, five-bucket/check IDs, rule version, applicability, status/reason, coverage, source references and assessed_at |
| brand_claims_and_suggestions | task/report, kind named_feedback/opportunity/advice, excerpts/source refs, assumptions and generation version |
| checklist_tasks/events | stable finding key, baseline/rule refs, lifecycle, first/last detected/checked, verification evidence and append-only history |
| report_versions/report_files | frozen config/evidence refs, timestamps, permission scope; private PDF key/hash, retained expiry |
| guest_free_access | scan, separate hashed owner/read capabilities, expiry and verified ownership linkage |
| deliveries | requested address, verification state/hash/expiry, report version, provider IDs and idempotency key |
| beta_vouchers | hashed code, eligible products, expiry/cap, atomic account-bound redemption |
| budget_ledger/audit_events | reservations/usage/reconciliation, redacted actions; no credentials/tokens |

Historical corrections do not mutate sources or prior reports. Payments can exist before final scan configuration, so order and config are separate.
Use transactions for entitlement/quota/budget reservations, schedule-slot claiming and voucher caps. Nullable location/task keys must still enforce logical uniqueness. Anonymous clients cannot directly read sensitive tables.

## Server contracts (logical routes)
Routes are proposed logical contracts, not implemented endpoints.
- Auth signup/login/verification/recovery handled by the selected auth service.
- POST /api/profiles and /api/questions: protected fetch/generation; account business ownership or bounded guest free context.
- PUT /api/businesses/:id/facts and /priorities: separate stores, approval history and source preservation.
- PUT /api/businesses/:id/question-sets: approval/versioning; reorder endpoint does not mutate wording.
- POST /api/checkouts: require authenticated account, resolve product/version/caps; create resumable order and checkout, not final prompts.
- POST /api/orders/:id/setup: require owner and paid/waived entitlement; validate approved final configuration within purchased scope.
- POST /api/beta/redeem: authenticated, bounded atomic waiver.
- POST /api/scans: authorized config + entitlement/free allowance + budget; idempotent enqueue.
- GET /api/reports/:id and /pdf: account ownership for paid reports; limited capability authorization for guest free reports.
- POST /api/reports/:id/email and /api/email/verify: owner context, requested delivery, verified destination.
- POST /api/reports/:id/retry and DELETE /api/reports/:id: authorized owner; bounded missing-task retry/deletion.
- GET /api/businesses/:id/checklist and POST /api/checklist/:id/owner-done: scoped access, evidence history; owner click is not verified completion.
- POST /api/subscription-checkouts and /billing-portal: only configured plans, authenticated customer; provider-verified subscription state.
- Payment/email webhooks: signature checks, event deduplication/out-of-order reconciliation.
- Scheduler and verification-worker endpoints: service-authenticated, not publicly invokable to start arbitrary work.

Verify authorization on every ID/file/export, not just navigation. Use secure cookies and CSRF protection. Reusing a submitted email does not prove ownership of reports or businesses.

## State machines
Order: checkout_pending → paid/waived → setup_pending → ready → fulfilled; failure/expiry/refund recorded independently. Account can resume paid setup without another payment.
Scan: draft → awaiting_entitlement → queued → running → completed | partial | failed.
Task: pending → running → succeeded | invalid_response | failed; retries create attempts, not duplicate logical task identity.
Payment: pending → paid → refund_pending → refunded; redirects alone grant nothing.
Delivery: awaiting_verification → queued → accepted → delivered | bounced | failed.
Checklist: Open → Owner marked done—awaiting verification → Verified complete; unsuccessful applicable check → Could not verify; recurring evidence → Open with prior history. Strategic task may be Owner completed, distinct.
Assessment color is separate from checklist lifecycle. A completed owner fix need not instantly improve AI-answer evidence.
Subscription/schedule: normalize provider events; execute only active authorized due work; exact cancellation/grace/catch-up behavior must be specified before billing.
Frozen reports remain historical; retries/refreshes create new versions with declared evidence changes. PDFs use the exact frozen version.

## Reliability and cost controls
- Parallelize providers within configured concurrency caps; use durable task leases.
- Retry transient errors with bounded exponential backoff, honoring provider rate limits.
- No automatic unlimited retries after ambiguous timeout; inspect provider/request status when supported.
- Reopening pages, duplicate webhooks or worker restarts must not duplicate scans/payment.
- Reserve budget for all configured calls including named-brand analysis, opportunity/advice generation, all locations and worst-case bounded retries.
- Global daily spending ceiling and per-scan ceiling; stop accepting work when capacity is exhausted.
- Conservative estimates for responses without usage metadata; reconcile later when possible.
- Free scans, profile/question generation and email/PDF endpoints all need abuse controls.
- Never silently switch to cheaper models after checkout. Surface outage/incomplete coverage.
- Deduplicate repeated client requests for the same task but never reuse one model answer as several independent runs.
- Record percentile latency; display progress instead of promising a fixed runtime.

## Security and data handling
Use authenticated account/business authorization for every paid purchase, order, scan, report, checklist and private file. Apply row-level/server ownership checks; prevent cross-business access and storage leaks. Service-role credentials stay server-side.
Free guest scans use high-entropy owner/read capabilities with hashed storage and private/no-store/noindex access. Do not expose paid reports through public bearer URLs by default. Optional future sharing requires scoped consent/revocation.
A verified account may attach a guest scan only after proof of both contexts; typed email matching is insufficient.
Email verification/recovery, rate limits, CSRF protection and secure HttpOnly/SameSite cookies are required. Auth mechanism and account retention policies must be resolved before production.
Public fetch SSRF protections: HTTP(S) only; reject credentials/private/link-local/loopback/metadata addresses; validate DNS and every redirect; cap bytes/time/redirects and content types.
Treat page/model content as untrusted data, not instructions. Sanitize generated HTML/PDF and safe-link protocols. No scripts or unsafe URL execution.
Keep secrets, raw report bodies, source text, recipient addresses, tokens and payment data out of analytics/logs/referrers. Stripe holds cards. Store requested delivery addresses only as needed.
Deletion must revoke access and purge applicable evidence/files while honoring disclosed audit/payment/backup exceptions. Account deletion cancels/handles pending work and billing per final policy; exact policy is a release gate.
Scheduler/webhook idempotency, tenant-scoped cache keys and private storage apply to recurring work too.

## PDF design requirements
Server-rendered, selectable text, readable typography, repeating table headers and page numbers. Include summary then evidence appendix. Render long URLs safely and preserve accents. Generate from stored evidence with no fresh model calls.
Verify sample long/Spanish/partial reports visually during implementation.

## Provider documentation to recheck at implementation
- OpenAI API web search: https://platform.openai.com/docs/guides/tools-web-search
- Anthropic web search: https://platform.claude.com/docs/en/agents-and-tools/tool-use/web-search-tool
- Google Gemini grounding: https://ai.google.dev/gemini-api/docs/google-search
- Perplexity: https://docs.perplexity.ai/ (verify the current supported API, model and search contract; do not assume old Sonar examples or consumer app equivalence)
Exact models, SDK syntax and pricing are deliberately not specified as fixed facts. Run paid sandbox smoke checks before enabling a provider. Search enablement and returned citations need provider-specific verification.


## Report composition and reuse
One shared engine supports the four report types in [the catalog](../product/report-catalog.md). Validate purchased product scope and minimum checkout inputs before payment; validate the complete report-specific execution schema and approved questions afterward, before any scan starts.
Analysis matches target and competitors against the same neutral answers. Distinguish mention, recommendation, named-brand suitability and generated ideas in stored fields and UI.
Reused evidence must have compatible immutable settings and permissions, preserve original collection time and count once as an observation. Do not reuse stale free responses as new paid repetitions. PDF generation never reruns models.
Compute competitor gaps only from successful, unambiguous observations under the declared mention/recommendation metric. Aggregate per provider/question/location and expose denominators.
Top-source counts derive from actual citation metadata; fetch source pages through the protected fetcher before claiming what they contain.

## Public site and private results
Implement [website structure and SEO](../product/website-structure-and-seo.md). Render substantive public product copy and links into initial HTML; provide metadata, canonicals, sitemap and accurate structured data.
Customer results, tokens, checkout, API routes and generated PDFs must not enter public sitemaps or public examples. Indexing controls are additional to access control.
Marketing product routes are distinct from account-protected result/API routes and guest free capability routes.

## Subscription and agency extension boundary
Dashboard is a specified subscription product and part of the design scope. Prompt checks run three times weekly; full brand/competitive/location assessments refresh monthly or twice monthly, choice open.
One-time purchases remain possible without monitoring subscription, but always require an account. Timed report bundles are separate recurring delivery products with unresolved billing/cadence/quantity terms.
Do not use the old blanket “no accounts/subscription” scope. Conversely, do not charge until plan prices/caps, exact schedule/timezone, cancellation, quota, history/retention and failure/credit policies are implemented and published.
Dashboard/bundle release timing is still open; agency packs, team/client permissions and integration management remain later work.

## Assessment and discrepancy verification
Implement [brand evidence/checklist rules](../product/brand-evidence-and-checklist.md). Five buckets, documented applicability/materiality and rule versions, source-level findings, gray collection failures and accessible labels. No numeric grades.
Preserve raw model perspectives separately from evidence-backed assessment. Rule changes/source coverage changes are disclosed rather than shown as business improvement.
Deduplicate checklist items with stable business/claim/source/rule keys. Store owner action, check attempts/results and lifecycle changes independently.
A website recheck can verify website correction while AI-answer discrepancy stays open. Failed/unrelated checks cannot close tasks. Recurrence reopens rather than erases completion history.
Verification evidence references baseline version and check scope/date; definition/repetition threshold for sampled AI corrections must be decided before automation.

## Monitoring and comparison mechanics
Use approved saved question versions; priority order is display metadata and never changes historical counts. New wording/language/location/provider configurations create compatibility boundaries.
Prompt checks three times weekly only; full modules use separate slower schedules with last/next checked metadata. A prompt run never implicitly verifies uncollected site evidence.
Worker claims unique schedule slot, snapshots scope, checks active subscription/credits and reserves cost atomically. Retries/restarts do not double-run or double-consume. Disable work on inactive entitlement under the finalized billing policy.
Chart real counts, sample sizes and gaps; label any smoothing/trend. Avoid misleading inference from single-run variance. Reuse source snapshots only with explicit freshness/coverage labels, never as new observations.
Pricing/cost estimates include all tasks, sources, advice, verification and failure overhead at each cadence; no old 48-call assumptions.

## Website discovery and accessibility implementation
[Section 1 implementation process](website-discovery-accessibility.md) defines page inventory/selection, provider-specific permissions, separate search and URL-reading tests, required tool evidence, cache/live distinctions, deterministic counts, budgets and release checks. This is a proposed implementation plan, not a deployed scanner. Use it with the approved report-section reference.


## Clear, concise & complete implementation
[Section 2 implementation process](clear-concise-complete.md) adds versioned industry questions, product-level applicability, source-grounded extraction, the three assessment criteria, deterministic status/count rules, missing-versus-unavailable handling, owner improvements and refresh/release requirements. It consumes Section 1's declared inventory and snapshots. It is a proposed implementation plan, not deployed functionality or a live provider test.


## Consistent & current implementation
[Section 3 implementation process](consistent-current.md) defines bounded source selection, qualified fact extraction, entity/rate alignment, independent consistency/currency judgments, deterministic counts, source-specific corrections and evidence-backed rechecks. Use the [shared standards](../product/ai-brand-perception/decision-fact-standards.md) with Section 2. This is an implementation specification, not a deployed audit or provider integration.


## Mandatory model layer — 24 October 2026
Use [Multi-model Brand Perception implementation](multi-model-brand-perception.md) for every section, with [versioned contract](../product/ai-brand-perception/multi-model-data-contract.md). The shared baseline pipeline is necessary but insufficient: collect and preserve all four providers' observed answers/tool evidence/citations, explicit test modes, matched denominators and compatible history. This supersedes any earlier decision to defer model understanding or omit provider columns. No production service or live calls are implemented in this documentation update.


## Distinctive & relevant implementation
[Section 5 process](distinctive-relevant.md) adds neutral named-site questions, evidence-bound association extraction, independent expression/alignment states, competitive comparison requirements and per-model history. Use the common provider provenance/budget/privacy pipeline. Present, emphasized, not mentioned, correctly excluded and misleading are not interchangeable. The reference is synthetic and does not implement or test a production scanner.

