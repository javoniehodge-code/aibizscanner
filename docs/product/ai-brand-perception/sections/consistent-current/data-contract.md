# Consistent & current — data contract v1.0

## Run and scope

Store `sectionId`, schema/rubric versions, report/run ID, business/property identity, language/market, assessment time, standard ID/version, selected fact IDs, applicable/excluded facts with reasons, sources and source-selection rationale. Persist source/assessor/extractor versions and snapshots. A production run uses the same standard version as Section 2, or explicitly discloses any difference.

The top-level counting unit is one applicable decision fact, never source count, provider count or room-times-rate combinations. Five to ten facts total, maximum ten across Core and When relevant. Attach room/rate/variant subchecks without changing the visible denominator. Excluded conditional items are outside the applicable denominator.

## Evidence and claims

A source record has ID, type, name, requested/canonical URL, collection result, retrieval timestamp, snapshot/hash, extraction version, and whether/how it was selected (including observed AI citations when actually available). Collection result distinguishes readable, partial and unavailable. An actual observed model citation also stores model/run/prompt provenance; do not infer it from our source selection.

An extracted claim has fact ID, property/product/room/rate/package identity, normalized value and units, currency, tax/fee inclusion, exclusions, applicable dates, effective/expiry dates where known, source ID and exact passage/location evidence. Distinguish date a source was fetched, date it was published, and date the policy applies. Do not derive truth from source counts or majority agreement.

Preserve the website's claim as `baselineClaim`, not `verifiedTruth`. Missing or contradictory baseline details must be surfaced. Owner corrections remain separately labeled until supported on the relevant public source. Production evidence IDs must resolve to stored snapshots and matching exact passages. Absence findings identify inspected scope, not a fabricated quote or universal absence claim.

## Fact record and independent dimensions

Each fact includes ID, label, bucket, applicability/reason, scoped entities, website baseline claims, external claims, evidence IDs, agreement assessment, currency assessment, display outcome, plain-language implication and linked fixes.

`agreementAssessment`: `agree`, `conflicting`, `insufficient`, `could_not_assess`. Require comparable website and at least one independent external source to call agreement; duplicated/syndicated pages count as one origin for coverage. Identical wording can establish agreement of descriptions without independent corroboration of quality. Explain absent external coverage. Lack of source wording is not disagreement.

`currencyAssessment`: `supported_current`, `outdated`, `unconfirmed`, `could_not_assess`. Require explicit applicability evidence, a dated change or suitable current authoritative statement to support currency. No universal freshness TTL proves validity. Store basis, policy/rule ID and evidence. Recently retrieved old content can be outdated; unchanged location facts may remain valid without a recently published page.

## Display resolution and counts

Resolve in order:

1. Exclude `not_applicable` facts with a reason.
2. If a validated relevant conflict or supported stale claim exists, `difference` (display Conflicting or Outdated); disclose incomplete coverage alongside it.
3. Otherwise, if comparison is adequately supported and both agreement and current applicability are established, `agree`.
4. Otherwise `unconfirmed`, with specific reason: unavailable source, missing baseline, insufficient detail, uncertain dates, unmatched rate/room, or insufficient external coverage. Never present these reasons as established conflict.

The fixture's `agree` label is “Agree across checked sources”; its underlying freshness has not been tested. Production UI must qualify an agreement when currency is unconfirmed rather than allow the label to imply the whole check passed. Show “Sources agree; current status unconfirmed” in the unconfirmed group.

For multiple room/rate subchecks, one validated relevant conflict causes the fact to display difference; no conflict plus unresolved essential subchecks causes unconfirmed; agree requires all declared applicable subchecks supported. Do not allow one well-documented rate to hide another in-scope restriction.

`applicableFactCount = agree + difference + unconfirmed`. Preserve detailed unresolved reasons separately; do not collapse unavailable into content absence. Sample 10=3+5+2, excluded=0. Counts are deterministic, not LLM-generated.

## Synthetic fixture and fixes

[Sample data](sample-data.json) intentionally contains null source URLs, dates and dimension assessments, no snapshots and no evidence. `isIllustrative=true` requires a visible design-example banner and excludes production comparisons/trends. Production validation rejects these omissions. Approved sample outcomes are design states, not evidence-backed grades.

Each fix has rank, affected fact IDs, source IDs, relevant claims/evidence, proposed correction, owner action and rationale. Updates should distinguish updating owned pages from requesting third-party corrections. Rechecks resolve each discrepancy only when the affected source is checked again; an owner marking a task done is not verification. Preserve immutable history and unresolved sources.

## Mandatory four-model extension — 24 October 2026
The [shared v2 contract](../../multi-model-data-contract.md) adds each provider's actual independent-search answers and citations, baseline-relative evaluations, source coverage and previous/current comparisons. Preserve the original source agreement/currency dimensions and counts as a separate baseline. Never turn source counts into model-answer counts or compare provider outputs with an undisclosed baseline answer key.

