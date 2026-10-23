# Brand evidence, owner baseline and checklist
Version 0.3 • 22 October 2026

## Baseline versus positioning
Import name/domain, locations, contact/hours, services, prices, relevant credentials and other public facts with source URL, excerpt and retrieved date. Allow approve/correct/unknown. A failed extraction offers manual entry.
Maintain three separate records:
- Observed facts in sources, with original evidence.
- Owner-confirmed facts/corrections, attribution and effective date where known.
- Desired positioning, priority products/services, customer needs and goals.

The owner correction does not rewrite a source or historical answer and is not independent verification. New baseline versions are effective from their date; review historical comparisons rather than retroactively changing them.
Preferences may order suggestions/prompts and advice. Never publish an unverified preference as a service fact or feed the owner's desired answer to unbranded discovery calls.

## Open-ended AI perspective
Ask each provider about the named business and its sources, when it would recommend/hesitate, suitable customer situations and possible improvements. Preserve actual answers, citations and uncertainty.
Generated suitable prompts and stated rationales are named-brand feedback, not tested recommendations or proof of internal decision processes.
Separately inspect evidence with the five buckets below. This framework is ours, not a provider's disclosed ranking formula.

## Five evidence buckets
| Bucket | Inspect | Avoid |
| --- | --- | --- |
| Accessible business information | Fetch/extraction, key facts, actual markup and published crawler rules; where facts can be found | Mandatory schema types, fixed heading style or proof of indexing/crawler access from robots alone |
| Independent validation | Relevant independent mentions, cited sources and material detail consistency within checked sources | Universal Reddit/Wikipedia targets, undisclosed authority weights or “not found” proving absence |
| Customer review evidence | Service details, recurring praise/concerns, dates, sample size and alignment with priority needs | Universal count/platform targets, definitive fake-review labels from text alone, influencing review content |
| Expertise and supporting evidence | Industry-relevant credentials, practitioner identity, substantiated experience, case studies/outcomes and original evidence | Requiring every business to publish research; claiming missing credentials in scanned sources means no credentials exist |
| Information currency | Current facts and time-sensitive contradictions, services/prices/hours, working contact/booking destinations | Rewarding mere posting frequency or date changes; universal 3–6-month expiry |

Source collection is bounded and disclosed. Incomplete source access is not an automatic failure. Factual observations and interpretive conclusions use different labels.
Use the same criteria/version and comparable source scope across competitors. Differences in source coverage remain visible.

## Status display
| Status | Meaning |
| --- | --- |
| Green — In good shape | Applicable documented checks have sufficient support; no material issue found in checked evidence |
| Yellow — Needs attention | Specific gap, incomplete/mixed support or limited actionable concern, with evidence |
| Red — Issue found | Supported material issue under the documented rule |
| Gray — Could not assess | Insufficient collection/verification; no negative conclusion |
| Gray — Not applicable | Criterion is inappropriate for this industry/scope |

Use color plus icon/text, never color alone. No numeric totals, A–F grades or universal readiness score.
Each bucket exposes check-level findings, rule/version, criterion, evidence URLs/excerpts, scope/date, interpretation, next action and verification method.
Aggregation rules and materiality/applicability thresholds must be documented before production and versioned. Do not let free-form model opinions arbitrarily change the color.
Keep dated assessment history and disclose rule/source-coverage changes. Green evidence is not proof that recommendation frequency improved; measure that separately.

## Discrepancy-to-task workflow
Example:
1. Owner confirms closing time is 7 p.m.; website and a sampled AI answer say 5 p.m.
2. Create a website task: “Publish confirmed 7 p.m. hours,” with page evidence.
3. Track an AI-answer discrepancy separately: “Sampled answer still reports 5 p.m.”
4. A successful website recheck can verify the website task even if AI remains outdated.
5. A later AI check can resolve the sampled-answer discrepancy under its verification rule. Do not claim every AI now knows the correct hours.

Task fields: stable ID, business, finding/category, source/claim key, relevant baseline version, suggested action, evidence links, verification rule, first/last detected, last checked, lifecycle status and history.
Deduplicate recurring findings by business/claim/source/rule rather than generating duplicates each refresh. New evidence updates the existing issue history.

## Lifecycle and verification
- **Open:** evidence-backed issue or actionable suggestion.
- **Owner marked done—awaiting verification:** owner reports a fix; evidence not checked yet.
- **Verified complete:** successful applicable recheck satisfies the stored rule; retain date/evidence.
- **Could not verify:** check failed or evidence insufficient; issue remains unresolved.
- **Owner completed:** owner-completed strategic/non-verifiable action, distinct from machine verification.

Recurring discrepancy reopens the existing task and preserves completed history. A refresh that still finds the same issue does not create a new task or reset its age.
Unrelated scans, absent mentions in a summary, failed fetches/provider calls and source omissions cannot verify completion.
Record last checked separately from lifecycle changes; update status only from evidence or an explicit owner action.
AI-answer verification applies to recorded observations with the disclosed sample/rule, not a universal claim about all future answers. Exact stability/repetition policy remains a production rule to define.
Reordering prompts cannot close tasks; changes in baseline/prompt/rule may require review rather than a silent “complete.”

## Refresh scope
One-off report reruns and scheduled modules recheck relevant findings. Three-times-weekly prompt runs can update only discrepancies supported by those answers or explicitly collected related evidence; they do not implicitly recrawl and reassess the full business.
Website/profile/brand tasks wait for the relevant successful source/full-analysis recheck, on the slower cadence or purchased report rerun. Display “Not checked in this refresh” or the actual last checked date when appropriate.
History, evidence and completed tasks follow disclosed retention; exact retention remains open.

## User-facing task card
Show: status, issue, observed versus owner-confirmed fact, source/date, why it matters, suggested action, last check and verification evidence.
Controls: inspect evidence, owner marks fix done, view history. Manual recheck button is a proposed paid/budgeted action, not an unlimited free promise.

## Approved first section — 23 October 2026
The report is now called the **AI Brand Perception Audit**. Its first section is [Website discovery and accessibility](ai-brand-perception/sections/website-discovery-accessibility/README.md): platform-specific website permission checks, explicitly selected/named pages, separate search and reading results, evidence and plain-language owner options. Use the linked approved white-background, black-text design for this section. This replaces this section’s previous generic accessible-information presentation; it does not finalize the rest of the report.

## Approved second section — 23 October 2026
Use [Clear, concise & complete](ai-brand-perception/sections/clear-concise-complete/README.md) as the second section of the **AI Brand Perception Audit**. Assess whether selected website information supports relevant recommendation decisions against a consistent industry checklist. Finding a product is insufficient. Keep evidence grounded, scope explicit and unavailable sources separate from missing content. The linked reference overrides older presentation/checklist guidance for this section only. Owner onboarding needs optional facts, not desired positioning.


## Approved consistency section and shared standard — 23 October 2026
Use [Section 3: Consistent & current](ai-brand-perception/sections/consistent-current/README.md) for the cross-source baseline. Follow the [shared decision-fact standards](ai-brand-perception/decision-fact-standards.md) in both completeness and consistency: 5–10 total facts, Core and When relevant only. Compare like-for-like entities/policies against the website baseline while flagging its own gaps. Missing, conflicting, unavailable and currency-unconfirmed remain distinct. The hotel fixture is synthetic. Prior generic coffee purchase-route checks are not the future coffee standard.

