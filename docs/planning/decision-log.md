# Decision log
Version 0.1 • 20 October 2026

## Status definitions
Confirmed = user explicitly agreed.
Proposed = reasonable implementation default, configurable and not represented as a user decision.
Deferred = out of v1.
Launch gate = must be resolved before public charging, not before starting development.

| Decision | Status | Rationale |
| --- | --- | --- |
| Serve local and online businesses | Confirmed | User selected both |
| Free and paid reports | Confirmed | User rejected free-only launch |
| Waive paid fee for beta users | Confirmed direction | Voucher mechanism is proposed |
| No required account | Confirmed | Minimize friction |
| PDF download and email delivery | Confirmed | Preserve results without an account |
| API-based measurements | Confirmed | Accepted tradeoff versus exact consumer app behavior |
| OpenAI, Anthropic, Google first | Confirmed direction | Prior recommended scope accepted; capabilities verified at build |
| English | Confirmed | Required initial language |
| Spanish | Conditional user preference; adopted default | User wants it if easy; manageable with early internationalization |
| One scan language at a time | Proposed | Avoid doubling test costs and scope |
| Next.js/Vercel/Supabase | Proposed | Previous suggestion, no explicit separate user confirmation |
| AI Visibility Checker working name | Proposed | No final brand supplied |
| Free 3 answers; paid 45 discovery + 3 recognition | Proposed | Small useful sample and repeated paid evidence |
| US$9 one-time paid price | Proposed / launch gate | Validate cost and willingness to pay |
| 30-day report retention | Proposed / launch gate | Bounded costs, disclosed expiry |
| Bearer read link and separate owner capability | Proposed | Anonymous access with controlled mutations |
| Verified email before evidence delivery | Proposed | Prevent unsolicited reports and misdirected evidence |
| Beta vouchers with expiry/use caps | Proposed | Fee waiver without unlimited compute |
| Full refund after unresolved paid partial failure | Proposed / launch gate | Clear early-stage coverage promise |
| Model IDs and actual search behavior | Launch gate | Provider interfaces evolve |
| Muse integration | Deferred | Suitable access not verified |
| Accounts, subscriptions, monitoring, bulk features | Deferred | Preserve narrow MVP |

## No answer inferred from unfinished text
The user's final “6.” contained no substantive decision. It is not approval of a new requirement or a final stack/name.

## Changes after this version
Record date, decision, reason, affected documents and status. Update related acceptance criteria when a behavior changes. Do not silently convert a proposed price or cap into a confirmed founder decision.

## Questions that can wait
Final name/domain, exact paid price, email/job vendor and operational spending limit are launch/setup decisions. None requires delaying the first working scan.


## Repository organization — 20 October 2026
Confirmed: user created javoniehodge-code/aibizscanner and requested uploading and organizing this pack. Documents are grouped under docs/product, docs/engineering, docs/quality and docs/planning. Application folders remain recommendations until implementation starts. Product behavior and provisional commercial defaults are unchanged.
