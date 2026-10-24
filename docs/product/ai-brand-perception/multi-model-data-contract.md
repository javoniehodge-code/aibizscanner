# Multi-model report contract v2.0

Applies to all AI Brand Perception Audit sections. Read with the individual section contracts. Shared baseline evidence and provider observations are distinct records.

## Run metadata

`reportId`, `runId`, `sectionId`, `businessId`, property/product/variant scope, industry-standard/rubric/question-set versions, `testMode`, language/market, account authorization, `isIllustrative`, start/end timestamps and selected baseline snapshot IDs/hashes.

Per provider store owner-facing label; exact provider/API endpoint or route; actual requested/returned model IDs/version; tool settings and observed tool availability; prompt/system-template version and full submitted prompt/hash; supplied source/passage IDs if any; requested and actual time/location context; generation parameters; trial index/sample plan; request/response IDs; raw response artifact; timestamps; actual tool/retrieval/citation artifacts; costs, retries and completion state. Never fill unknown provider/version or capability fields by guesswork.

## Baseline and observations

A baseline record has fact/topic ID, exact entity/scope, supported value or evidence assessment, qualifiers/uncertainty, consistency and currency dimensions where relevant, source snapshot/evidence references and assessor/rule versions. It is not one model's vote and is not sent as an answer key to independent-search tests.

Each observation references its provider run and fact/topic, full answer artifact, extracted claim spans, status, reason, baseline version used, exact evidence IDs and citation records. Citation records include provider-native citation IDs/spans, actual disclosed URL/title, linked question/claim IDs, validation state and retrieved evidence when available. A cited URL alone is not proof its content supports a claim. Preserve unverified/missing citations distinctly.

For supplied-evidence diagnostics, store supplied source IDs separately from sources actually referenced in the answer. A supplied document is not automatically a cited or autonomously retrieved source. A copied website passage must not be called an observed crawl by the provider.

## Status dimensions

- Collection/run state: `completed`, `partial`, `unavailable`, `not_tested` (with reason). Tool failure is not a brand failure.
- Answer state: `answered`, `qualified`, `not_addressed`, `abstained`, `unsupported`, `conflicting`. Preserve the exact answer and explain whether uncertainty is appropriate.
- Section 2 answer evaluation: fully supported / partial / wrong / unsupported / no answer. Correct abstention can avoid hallucination but does not complete the product-information answer.
- Section 3 evaluation: matches scoped baseline / conflicts / unsupported / not established. A correctly qualified answer to unresolved baseline facts may match; it does not establish that the fact itself is known or current.
- Section 4 evaluation: evidence aligned / partial or caveat omitted / unsupported or overstated / not addressed. Keep independent evidence citation strength separate from alignment of the conclusion.

Renderer must show unavailable/not-tested states rather than scoring missing rows. Every scored production observation requires a valid completed response, rule/reason and sufficient evidence for its status; unsupported/absence findings preserve scope and validation rationale rather than invented supporting quotations. If the shared baseline is unresolved, assess appropriate qualification or mark evaluation unresolved; do not manufacture a true/false key.

## Counts

Declare unit and denominator per section/provider. All four columns use the same applicable items. Display supported/matching/aligned count **of total applicable**, with completed, unavailable, not-tested, abstained and other outcome counts disclosed. Distinguish answer alignment from website quality and recommendation frequency. Do not use one composite score across sections.

Section 1 retains its page-based permission/discovery/reading denominators; Sections 2–3 use facts/questions, Section 4 uses disclosed topics/questions. Multiple trials attach to the same question/provider; they do not silently expand the number of facts. For sampling, show independent-trial results separately or as an explicitly labeled question/trial metric.

The sample fixtures use aliases `supported`, `partial`, `wrong`, `unsupported`, `no_answer`; `match`, `conflict`, `not_established`; `aligned`, `partial`, `unsupported`. Their abbreviated display answers and source strings are **synthetic copy**, not valid normalized citations or stored API responses.

## Source matrix

Source strength is assessed once per claim/topic, independent of citation frequency and positivity. Store relevance, specificity, independence/disclosures, evidence basis, limitations, claim IDs and source/evidence provenance. Per-model citation counts derive only from recorded citation records for a declared run/question set. Binary “cited at least once” and frequency are different metrics; label which is shown. Deduplicate URLs/origins while retaining each actual citation event.

Do not label a source unused, blocked or unimportant merely because it was not cited. Do not infer causal influence from citation presence. A source not in the original baseline but actually cited is added for assessment or marked not yet assessed; never silently grade it or discard it.

## Longitudinal records

History references prior/current run IDs, exact matching fact IDs, counts/statuses, before/after answer and citation records, comparator version, compatibility result/reasons and separately recorded source/owner changes. Preserve exact original baselines. Model/version, tool/mode, standard/scope/question or sampling changes create a visible comparison boundary; no uninterrupted trend without qualification.

Cache reuse retains the original observation timestamp and is never a new answer. An unchanged score can still contain changed sources, improved qualifications or new errors; preserve row-level changes. First run and failed refresh are explicit. Changes remain descriptive, not causal.

## Synthetic fixtures

`isIllustrative=true`, actual model calls/retrievals zero, raw response/model IDs/timestamps absent and no real evidence. Both current and previous fixtures are synthetic. Always render the visible example banner. Reject them from production trends, billing reports and live evidence scoring. New examples cannot masquerade as historical customer runs.

## Section 5 extension — 24 October 2026
Use [Distinctive & relevant contract](sections/distinctive-relevant/data-contract.md) for association taxonomy/version, exact answer spans, expression versus evidence alignment, explicit exclusions/negation, question-set coverage and model-specific history. Frequency needs a declared answer/opportunity denominator, not word counts. Named comparative evidence is required before claiming advantage. Partial/unavailable tests cannot silently yield not-mentioned. Synthetic previous/current examples do not enter production trends.

