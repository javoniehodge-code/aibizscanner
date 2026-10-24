# Clear, concise & complete — data contract v1.0

This contract specifies a proposed implementation. [Sample data](sample-data.json) is explicitly illustrative and must not pass production evidence validation.

## Assessment unit and scope

One top-level row is one recommendation question for a declared set of selected products and selected pages. Store product-level subchecks in `productChecks` when more than one product is in scope. A row is not a per-model result. Do not silently turn eight questions into a question-times-SKU denominator. Show partial product coverage explicitly.

Required run fields: `schemaVersion`, `sectionId`, `assessmentRunId`, `assessmentType`, `isIllustrative`, `assessedAt`, industry template ID/version, rubric version, selected source IDs, product IDs and applicable question IDs. Production runs also preserve content hashes, assessor/configuration versions, selection rationale, language/market and evidence freshness.

`siteTotalPageCount` is nullable and never inferred from selected-page count. Page inventory references Section 1. Record selection changes instead of silently extending scope.

## Source and evidence records

Each source has ID, display name, canonical and requested URLs, collection status, snapshot ID/hash, retrieval timestamp and extraction version. Production collection statuses: `readable`, `unavailable`, `partially_readable`. Fixture-only `reference_only` is never evidence.

An evidence record contains ID, source ID, snapshot ID/hash, exact text excerpt and matching location/offset, product/variant ID, claim or required-field ID and retrieval time. Structured markup can supplement visible content; record provenance distinctly. External purchase links need separate evidence if prices or stock are actually checked. Never label an unvisited linked page as inspected.

## Question record

Required: stable ID; plain-language question; required information; applicability and reason; explicit product scope; source IDs; source coverage; per-product checks; criterion assessments; status; plain-language finding; evidence IDs; assessment time; illustrative flag. Production required fields must not be null.

Each `criterionAssessments` entry (`clear`, `concise`, `complete`) has `met`, `partial`, `not_met` or `unknown`, with reason and evidence IDs. For absence findings, cite the inspected scope and searched required fields; do not invent an excerpt proving universal absence. Each `productChecks` entry carries product ID, required-field states, criterion results and evidence references. Required-field states: `supported`, `ambiguous`, `not_found`, `unavailable`, `not_applicable`.

The illustrative fixture leaves criterion assessments null and product checks empty because these were not independently assessed in the design. It preserves the approved top-level outcomes only. A production renderer must reject these omissions unless `isIllustrative=true` and a visible design-example label is shown.

## Deterministic status rules

Apply in order:

1. `not_applicable`: no relevant buying decision for the declared product scope; explain why.
2. `could_not_assess`: collection failure or unavailable required sources prevents a defensible content judgment. Do not convert inaccessible content into absent content. Positive conclusions may still be made when the readable evidence establishes every required fact; disclose unavailable sources.
3. `enough_detail`: every applicable in-scope product check meets clear, concise and complete, with supported required fields and relevant qualifiers.
4. `some_detail_missing`: relevant usable information exists, but ambiguity, indirect presentation, missing distinctions, a missing applicable product or a required detail still requires inference.
5. `not_enough_information`: selected readable sources provide no usable decision answer or omit facts essential to making the match. The industry rubric must identify those essential fields in advance.

Essential-field failure takes precedence over partial detail; nonessential gaps may yield `some_detail_missing`. Persist the exact rule ID that produced the outcome. Do not average criterion scores, claim probabilistic AI comprehension or award a recommendation probability.

For multiple products, `enough_detail` requires all declared applicable subchecks to pass. An essential unanswered in-scope case yields `not_enough_information`; other mixed assessable cases yield `some_detail_missing`. If unresolved collection prevents this determination, use `could_not_assess` and show any completed subchecks.

## Counts and display

`applicableQuestionCount = enough_detail + some_detail_missing + not_enough_information + could_not_assess`.

`assessableQuestionCount = enough_detail + some_detail_missing + not_enough_information`.

Show counts as “X of Y applicable questions” and separately show unavailable questions if present. `not_applicable` is excluded. Never hide unavailable questions behind a success percentage. Sample: applicable=8, assessable=8, selected pages=6, statuses=4/2/2/0/0.

## Improvements and lineage

Each improvement has rank, title, question IDs, finding/evidence references, affected product/source IDs and concrete suggested information. Do not generate unsupported product claims or guarantee more recommendations. Store raw findings separately from display copy. Reassessment creates a versioned run; it never rewrites historical evidence. Compare runs only with compatible template, scope and rubric, or show the differences.

## Mandatory four-model extension — 24 October 2026
Use the [shared v2 model contract](../../multi-model-data-contract.md) in addition to the baseline contract above. Add independent provider run/observation records, full answers, supplied-source versus actual citation provenance, baseline-relative statuses and compatible per-model history. Baseline findings alone are not report completion. This supersedes any statement that the report needs no provider columns; the baseline itself is still assessed once.

