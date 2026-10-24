# Section 3 implementation: Consistent & current

Proposed implementation process, 23 October 2026. [Approved visual and reference](../product/ai-brand-perception/sections/consistent-current/README.md). This update documents a system specification; it does not deploy a collector or run a live audit.

## 1. Freeze the decision standard and scope

Load the [shared decision-fact standard](../product/ai-brand-perception/decision-fact-standards.md), account/report identity, selected property/product scope and applicable facts. Use the same standard version as Section 2. Total 5–10 facts, maximum ten across Core and When relevant. Store conditional exclusions and reasons; do not invent extra report buckets.

Use the website as comparison baseline, not infallible truth. Source access is governed by Section 1's collection controls; incomplete website evidence remains visible. Optional owner facts/corrections are separately sourced; do not collect desired positioning. Preserve current approved coffee/hotel standards and the documented migration from the old coffee fixture.

## 2. Select and collect sources transparently

Begin with the canonical owned pages supporting the decision facts, then a bounded set of relevant third-party booking/product listings, guides or other sources that actually describe those facts. Prefer sources encountered in recorded AI/search runs when available, but do not claim AI influence from our own search alone. Store discovery query/tool/run, rationale, deduplication origin and coverage per fact. A source without relevant wording is not evidence of agreement or conflict.

Reuse Section 1's URL validation, SSRF/network restrictions, access controls, bounded requests and snapshot storage. Reuse cached snapshots only with original retrieval dates and freshness/coverage labels. Expand scope explicitly when following policy or rate links. Mark unavailable, partial and readable content separately; a blocked source is never a missing policy or a contradiction. Production source selection, count and spending limits are configurable implementation choices, not the five synthetic categories in the mockup.

## 3. Normalize claims without erasing qualifiers

Extract exact evidence spans and structured claims for each fact. Resolve the same property, product, room type, rate/package, market and policy period before comparing. Store original wording beside normalized fields, currency/units, per-night versus per-stay charges, included/excluded taxes, eligibility, exceptions and effective dates.

A $75 per-stay charge is not the same as $75 per-night. Breakfast included in one package and charged in another is not automatically a conflict. Cancellation conditions must attach to a specific rate and deadline. Distinct products or old/new versions cannot be compared as the same entity without explicit linkage.

Use rule-backed parsing where possible. A bounded LLM may propose extraction/matches, with evidence IDs and uncertainty, but cannot invent missing qualifiers or obey instructions embedded in source content. Validate exact spans, entity linkage and relevant qualifiers against snapshots. Retry within budget or retain an unresolved assessment. Do not infer facts from an inaccessible booking screen, automatically submit bookings, or access private data beyond authorized scope.

## 4. Assess consistency and currency independently

Consistency compares supported like-for-like claims; it is not a majority vote. One relevant validated conflict must remain visible even if many sources copy the website. Missing information, vague accessible labels and unmatched rate conditions are insufficient evidence, not necessarily disagreement. A missing or internally contradictory website baseline must be flagged rather than automatically accepting it.

Currency requires evidence the fact applies now, such as an explicit effective period, a clear current policy statement or a dated documented change. Keep retrieval, publication, last-modified and effective dates separate. A recent fetch does not make old content current, and an old publication date does not prove a stable fact is stale. A documented permanent pool closure can establish a roundup is outdated; a construction end date that has passed does not prove construction actually ended.

Define fact-specific refresh priorities and acceptable evidence in versioned rules. These govern rechecking, not automatic truth. Specific trip rates and stock need fresh checks; static neighborhood descriptions are treated differently. Do not label a source outdated merely because it disagrees with the website unless there is evidence of supersession; use conflicting/unconfirmed instead. Quality, authenticity and independent substantiation belong to the credible/corroborated section.

## 5. Resolve outcomes and produce the report

Apply the [data contract](../product/ai-brand-perception/sections/consistent-current/data-contract.md): validated conflict/stale claim → difference; adequately supported agreement plus current applicability → agree; unresolved evidence/qualifiers/currency → unconfirmed. Exclude inapplicable facts before counts. Preserve separate dimensions, source coverage and unresolved collection limits under any combined display label.

Count each applicable fact once regardless of source/room/rate count. Aggregate scoped subchecks conservatively: a relevant validated conflict remains a difference; unresolved essential subchecks prevent agreement. Render the approved table and 3-category summary deterministically. Do not ask an LLM to calculate counts or infer a probability of recommendation.

Write implications conditionally: “AI could exclude you from dog-friendly recommendations,” not “This is why ChatGPT excluded you,” unless separately evidenced in an actual run. “Descriptions agree” for atmosphere does not establish the real guest experience. Link evidence to exact source names, pages, wording and dates; expose coverage and comparison reasoning in expandable details.

## 6. Generate source-specific corrections

Rank fixes by relevance to hotel selection and severity of the demonstrated mismatch. Start with facts that could make a stay unsuitable, then cost/inclusion errors and unresolved essential detail. This prioritization method is an implementation proposal; no speculative impact score is implied.

Each fix references the fact, conflicting claim, affected source and correction needed. Recommend updating owned pages or requesting changes from third parties as appropriate. A source correction is not automatically authorized outreach: do not send messages or modify listings without separately authorized action. If the baseline lacks detail, clarify it first; do not instruct third parties to copy unsupported claims.

Map issues into the existing discrepancy checklist. An owner marking a fix done does not resolve it. Resolve only after the affected source is rechecked and the new evidence supports resolution; preserve unresolved or unavailable sources. Avoid duplicate tasks for the same source/claim while linking shared issues to all affected facts.

## 7. Run, refresh and compare safely

Pipeline: freeze standard/scope → select sources → collect/reuse snapshots → extract qualified claims → align entities → assess both dimensions → validate evidence → resolve outcomes/counts → generate fixes → render/store versioned report.

Persist immutable run metadata, snapshots/hashes, assessor/rule versions, claims, comparisons, source dates, costs and errors. Use durable stage checkpoints and an idempotency key spanning report/scope/source/standard/rubric versions. Enforce entitlement and bounded page/token/retry budgets without duplicate charges on retry. Incomplete collection produces disclosed partial results, not invented evidence.

Real source snapshots, owner data and reports remain private with account authorization and retention controls. GitHub contains only documentation and synthetic examples. A prompt-only monitoring refresh does not silently recollect this section. Recheck under an authorized source/full-report cadence; retain source-specific last-checked dates. Compare history only with compatible standards and scope, or visibly explain changes. No claim that fixing a discrepancy caused better AI recommendations without separate testing.

## 8. Release acceptance cases

- Synthetic fixture: ten facts, five Core/five When relevant, 3 agree/5 difference/2 unconfirmed; no real source URLs, snapshots, timestamps or live-test claims invented.
- Validate total facts at 5–10, excluding irrelevant conditional rows; reject a combined count over ten.
- Agreeing but stale or currency-unknown sources cannot receive an unqualified current pass.
- Different rooms, dates, packages, currencies and per-night/per-stay units are not falsely compared.
- Website error or missing policy is surfaced; external majority does not silently override or verify it.
- Validated contradiction can be reported despite a different unavailable source; disclose that coverage.
- Unreadable source, empty extraction and source silence do not become policy conflicts.
- Vague accessibility text cannot establish specific room suitability; expired construction schedule cannot establish completion.
- One current conflicting pool/pet claim is not averaged away by copies of the baseline.
- Exact evidence spans, qualifiers, provenance and identity must validate; prompt injection cannot change criteria or trigger actions.
- Counts match stored fact statuses; excluded facts and unavailable source reasons remain inspectable.
- Corrections resolve only on affected-source recheck; cached snapshots keep original dates; jobs resume without duplicates.
- UI remains all-black text on white, plain-language, keyboard-accessible and mobile-readable, with no false per-model source-use claims.

These are future implementation acceptance requirements. No production scanner tests or live hotel assessment were performed by this logging task.

## Mandatory provider-answer pipeline — 24 October 2026
The source comparison above is the shared baseline subroutine. Add [independent-search observations](multi-model-brand-perception.md) for all four providers, actual answers/citations, baseline-relative status and compatible model history. A corrected source and a corrected model answer have separate recheck triggers. See [revised section reference](../product/ai-brand-perception/sections/consistent-current/model-comparison.html). Provider answers cannot be replaced by our source-only assessment.

