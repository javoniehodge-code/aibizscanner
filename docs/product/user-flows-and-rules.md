# User flows and product rules
Version 0.1 • 20 October 2026

## 1. Identify the business
Fields: business name (required), website (required), scan language (English/Spanish), optional target market/location.
Accept a bare domain and normalize to HTTPS where possible. Explain that the site must be publicly accessible.
Read homepage plus up to two relevant public pages. Show inferred business category, services, location and detected name aliases for correction.
If extraction fails or is blocked, offer manual description/category entry. A failed crawl is not evidence of low AI visibility.
Keep target business data for question preparation and result matching; it must not enter the discovery answer-generation context.
Separate UI locale from scan language. Default both to English unless the user changes them.

## 2. Review questions
Generate five candidate customer questions using the confirmed business profile. State that these are suggested questions, not verified search-volume data.
Free users select one; paid users confirm five. Users may edit before committing.
Reject blank questions and discovery questions that explicitly include the target business, its domain or confirmed aliases. Flag ambiguous generic-word names for review instead of blindly blocking all occurrences.
Show target market and language alongside questions. Location is wording in the prompt, not a guarantee of the provider's physical search location.
Freeze an immutable configuration snapshot before payment/start. A changed question or language creates a new configuration.

## 3. Select access
Free: show the sample scope and start after allowance/cap checks.
Paid: show exact price, scope, supported providers, one language, retention, PDF/email access and failure policy before checkout.
Beta: redeem an expiring, limited-use server-validated voucher to receive the paid scope for zero charge. Do not collect a card for a full waiver.
Proposed price is US$9. Public charging stays disabled until cost validation and payment configuration are complete.
Use verified payment-provider events to grant paid entitlement; a browser “success” redirect is not proof.
Free and paid scans reserve budget before enqueueing. If capacity is unavailable, say so before charging. If a paid scan cannot start after payment, refund rather than leaving it indefinitely queued.

## 4. Run
Display provider progress and successful/expected answer counts. Use real states, not invented percentages or time promises.
The job continues when the tab closes. Preserve a recovery capability in the original browser.
Each discovery attempt uses a fresh conversation. Repeated attempts are real new requests, not cached duplicates.
A provider failure must not prevent other providers finishing.
Bound retries; never retry indefinitely or bill twice for a refreshed page.
Show a partial report if some answers fail. Do not classify missing responses as non-mentions.
Final completion freezes the report version for consistent PDF/email output.

## 5. Read results
Summary: completed discovery answers, business mentions, confirmed website citations and incomplete attempts.
Provider table: exact model, mention count/valid answer count, citation count/valid answer count, partial/error labels.
Question detail: each attempt, original answer, actual citation links and status.
Competitors: observed entities and frequency in sampled discovery answers; count each competitor once per answer. A generic phrase is not automatically a business.
Recognition: separate panel for paid/beta reports, with named-business responses and identity warnings. Do not claim factual accuracy without independently verified evidence.
No arbitrary numerical rank. Mention order is not a recommendation rank. Citation order is not a business rank.

### Counting rules
A valid answer is a completed substantive answer with usable text. Refusals, tool failures and empty responses are excluded from the discovery denominator and shown separately. A substantive “I could not find suitable businesses” remains a valid zero-mention answer.
Mention statuses: confirmed, ambiguous, absent. Ambiguous mentions are disclosed and not included as confirmed.
A model merely echoing the supplied question in recognition mode does not establish recognition.
Citation statuses: confirmed structured citation, URL mentioned in prose, no citation, metadata unavailable. Only the first counts as a website citation.
Deduplicate multiple links to the same owned domain within a single answer for the headline count; preserve all individual sources in evidence.
Recognition and discovery have separate denominators. Never combine different languages.
Do not present small-sample percentages without counts or infer population confidence from correlated repeated model responses.
If a provider lacks required search/citation support, mark it unavailable rather than silently changing the test.

## 6. Download PDF
Available on free and expanded completed/partial reports without entering email.
Generate from the frozen report, including limitations, exact questions, answer statuses, provider/model details, counts, original answers and sources. Long evidence may use an appendix; never silently truncate.
PDF failure does not invalidate the scan. Offer retry without rerunning AI calls.
A PDF already downloaded cannot be remotely revoked when the web report expires.

## 7. Email without an account
An explicit “Email my report” action asks for one address. Explain that verification is required and that this does not subscribe the recipient to marketing.
Send a short verification link with no business/report details. After recipient verification, deliver the report link and PDF attachment subject to attachment size limits; for oversized PDFs, use the verified download link and explain.
Verification token: one-time, short-lived (proposed 30 minutes); delivery retries are idempotent.
Proposed limits: 3 verification requests per report per hour and recipient/IP-level limits. Add an abuse challenge when warranted.
Changing address requires new verification. A payment receipt email is not blanket marketing permission.
Separate statuses for queued, accepted by email provider, delivered if supported, bounced and failed. Do not claim inbox delivery merely because the API accepted the message.
This specification authorizes no actual emails in the present documentation task.

## 8. Access, retention and recovery
Reports use unguessable bearer links. Anyone with the link can view them; say so before sharing. No public directory, search indexing or account history.
Proposed retention: 30 days for free and paid reports, with expiry shown on-page and in email. After expiry, delete report evidence/PDF and delivery address according to the configured retention process. Keep only required payment/audit records separately; final record-retention policy needs review before charging.
Original browser retains an owner-management capability distinct from the read link. Only owner capability permits requesting email delivery, reruns or deletion. Read-link holders may view/download.
Without the original browser or a previously verified recovery email, anonymous report recovery is not promised.
Owner can request deletion; revoke links and delete generated report files. Payment records follow their separate policy.

## 9. Failure and refund default
Retry failed attempts once automatically where safe and transient. Provider timeouts may still incur provider charges; record attempt identity and avoid repeated ambiguous retries.
For a paid report, after bounded retries, offer one user-triggered retry of missing attempts only, or a full refund if any promised provider coverage remains incomplete. Do not charge again. A refund preserves already delivered evidence until normal expiry.
All-failed paid scans trigger a full refund automatically. Free/beta failures have no cash refund.
PDF/email issues get delivery retry first; if export/delivery cannot be restored, provide support/refund path.
Implement refund policy as a proposed launch default; publish the final policy before accepting live payments.

