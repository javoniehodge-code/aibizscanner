# Section 2 implementation: Clear, concise & complete

Status: proposed implementation process, 23 October 2026. The user approved the [section reference](../product/ai-brand-perception/sections/clear-concise-complete/README.md), not a deployed scanner. This document adds the implementation specification to the system documentation.

## 1. Inputs and contract

Consume the account/report scope, industry, language/market, selected website inventory and readable source snapshots from [Section 1](website-discovery-accessibility.md). Preserve exact selected page names, URLs and why each was selected. Do not perform a second unexplained six-page selection, infer full-site coverage or use each provider's individual access failures as content-quality failures.

The baseline assesses our available website evidence. Provider access remains Section 1; actual AI understanding and recommendations are separate experiments. No provider columns or per-model scores are required here.

Use the [versioned contract](../product/ai-brand-perception/sections/clear-concise-complete/data-contract.md). Real collection evidence is required before replacing fixture text or removing the design-example label.

## 2. Version the industry standard before assessing

Create a checklist registry with industry/subtype, question IDs, required facts, essential versus supporting fields, applicability conditions, acceptable qualifiers and criterion rules. Begin coffee with the eight approved decisions. Broaden when buyer needs justify it: ingredients, allergens or certifications may be relevant; do not require every possible claim for every brand. Standards should cover local services, hospitality, health, professional services and other CPG categories with their own decision facts.

Freeze the template/rubric version per run. Apply product applicability before judging completeness. Machine compatibility applies to the specific capsule system; a ground-coffee product does not fail because it lacks capsule compatibility. Owners may confirm facts and scope; desired brand positioning is not an onboarding requirement. Record owner statements separately from publicly supported facts.

For each applicable question declare the exact product/variant scope and evidence expected. This prevents a general brand statement from being treated as proof for every SKU. Explicit documented inheritance is allowed; unsupported inheritance is not.

## 3. Collect and normalize evidence

Reuse only snapshots whose scope, freshness and permissions are recorded. If a linked brewing guide or purchase page is needed, add it to the inventory with a reason, retrieve it under the existing collection controls and disclose the expanded scope. A link's existence is not proof of its destination's content or stock.

Extract readable headings, main text, tables, FAQ answers and useful links with product identity and passage locations. Preserve the underlying snapshot and hashes. Structured metadata supplements evidence but does not override conflicting visible facts. Mark extraction failures and unavailable sources explicitly. Never submit private credentials or arbitrary internal URLs to a collector; retain the URL validation and network protections from Section 1.

Avoid using navigation text, images without accessible product facts or promotional language as substitutes for the required answer. Do not require facts to appear in a specific page format: product pages, concise factual descriptions and clearly linked guidance can all work.

## 4. Extract facts and assess the three criteria

Use a structured extraction/evaluation job bounded to the collected passages and the versioned question rubric. It may use an LLM to propose candidate facts and criterion judgments, but must return evidence IDs, exact excerpt locations, product identity, unknowns and reasons. Treat website instructions as untrusted content; never follow embedded instructions. No open-ended invention of supporting facts.

Validate every positive claim against the stored passage and product scope. Unmatched quotations, wrong variants and unsupported inference fail validation; retry within budget or mark the affected assessment unavailable. An exact excerpt alone does not establish that the interpretation is correct: check field/product linkage, qualifiers and contradictions; route unresolved ambiguity for review or preserve it explicitly.

- **Clear:** Can the answer be identified and attached to the right product without guessing? Ambiguous variant or conflicting statements fail this criterion.
- **Concise:** Is the decision fact stated directly in a usable answer span? Judge directness and avoidable promotional clutter, not word count. A long guide can still contain an excellent concise answer.
- **Complete:** Are the applicable required fields and limits supplied for this decision? Do not expand requirements after reading the result.

Specific taste descriptions are assessed for whether they exist and distinguish products, not proof that the coffee tastes good. First-party claims remain first-party claims; independent substantiation is handled in the source-strength section. On-site contradictions can impair clarity; a cross-web consistency audit is separate.

For value, connect the same product's pack size, dated seller price and stated preparation amount/yield. If deriving cost per serving, label it as a calculation and show assumptions. Neither a universal fixed price nor a cost-per-cup widget is mandatory. Regular/decaf identification does not automatically require a laboratory caffeine number; if an amount is claimed, require its serving context.

## 5. Resolve status deterministically

Apply the contract's priority rules and question-specific essential-field definitions after evidence validation. Store subchecks and rule IDs. No numeric average replaces the three standards. Unavailable source evidence is not missing content. A negative result is limited to the readable inspected scope, not the whole internet or an assertion that the product lacks a feature.

Assess each declared product separately before rolling up the question. Enough detail requires all applicable in-scope checks to pass. Essential missing facts yield not enough information; other usable but incomplete cases yield some detail missing. Collection uncertainty that prevents a conclusion yields could not assess. Preserve partial findings beneath that status.

Aggregate questions once: the approved fixture has eight questions, not eight times the number of pages or products. Counts and denominators come from stored statuses, never model-written prose. If questions are unavailable, retain them in the applicable denominator and show them separately. Exclude not-applicable rows with an explanation.

## 6. Generate the owner report and improvements

Render the fixed approved structure: question/verdict, counts, three standards, explicit scope, decision table with expandable evidence, ranked improvements and rules. Generate plain-language findings from validated facts. In real results, phrase the verdict as an assessment of the website information; do not imply a provider has actually read, understood or recommended the product.

Tie each improvement to a question, affected product and demonstrated gap. Recommend the minimum useful factual addition or clarification. Do not default to adding an FAQ, schema, comparison widget, invented tasting note or a promise of increased recommendations. Rank by importance to the relevant buying decision and severity; make prioritization rationale inspectable. New recommendations must not introduce owner positioning collection.

Maintain white background and black text throughout, including secondary copy, links and expanded details. Use status labels/symbols and accessible headings/tables. Scope counts and evidence dates must remain visible/readable on mobile; allow horizontal table scrolling.

## 7. Jobs, persistence and refresh

Proposed job stages: load/freeze scope → collect/reuse recorded sources → extract product facts → evaluate criteria → validate evidence → resolve statuses/counts → generate improvements → render/store versioned report. Persist stage state and idempotency key from report/scope/snapshot/template/rubric versions. Retries must not double-charge or create duplicate runs.

Use bounded concurrency, page/token/time budgets and limited retries under the existing entitlement controls. Partial collection must preserve completed evidence and disclose remaining gaps. Do not silently launch a full catalog crawl. An inaccessible source can leave a section incomplete without turning into a failing quality grade.

Keep real snapshots, owner facts, evidence and reports private under account authorization and the project's retention policy; GitHub holds specifications and synthetic fixtures only. Log rule, extractor and assessor versions, source retrieval dates/hashes, costs, errors and changes. A cached snapshot retains its original collection date. Regeneration from the same snapshot is not a fresh website observation.

A prompt-only refresh does not rerun this assessment. Reassess on an authorized source refresh or full-report run. Track old/new facts and status changes; flag scope/rubric changes before showing trends. Do not claim causal improvement in recommendations from a content edit alone.

## 8. Release checks

- Fixture validates: six unique selected pages; eight unique applicable questions; counts 4/2/2; no evidence/timestamps invented; illustrative banner visible.
- Positive and negative evidence handling: direct factual statement passes; generic promotional wording does not supply missing fields; a passage about one SKU cannot pass another.
- Missing versus unavailable: unreadable required page yields could not assess; readable selected sources lacking an essential fact yield scoped not-enough-information.
- Applicability: ground coffee is not failed for capsule compatibility; an irrelevant certification requirement is excluded.
- Mixed products: one fully documented variant cannot hide a missing in-scope variant. Essential-field and nonessential-gap precedence match the contract.
- Evidence integrity: wrong offsets, fabricated quotations, conflicting fields, stale prices and missing provenance are rejected or disclosed. Prompt injection cannot change the rubric or trigger actions.
- Counts: not applicable excluded, unavailable retained and displayed, no page/product/model denominator mixing.
- UI: named clickable pages, source dates in real evidence, all-black text on white, keyboard-usable details, small-screen table access, no fake per-model comprehension scores.
- Refresh: resumed jobs are idempotent; cached evidence keeps its date; scope changes are visible; access controls prevent another account reading evidence.

These are acceptance cases for future implementation. This documentation update does not add or run a production audit service.

## Subsequent shared-standard requirement — 23 October 2026
Use the approved [shared decision-fact standards](../product/ai-brand-perception/decision-fact-standards.md) for new runs, shared with [Section 3](consistent-current.md). Total 5–10 facts across Core and When relevant. The original eight-question coffee fixture is a historical synthetic design reference; migrate future checklists as documented rather than reusing its outcomes. In particular, routine local availability/purchase-route checks are outside the nationally distributed coffee standard.


## Mandatory provider-answer pipeline — 24 October 2026
This document's collection/rubric work defines the **shared baseline subroutine**. It is no longer the whole section. Add the [multi-model implementation](multi-model-brand-perception.md), four observed answer columns, explicit supplied-website diagnostic mode, provenance and per-model compatible history. A website gap, model abstention and model error despite clear text are separate outcomes. This extension supersedes baseline-only/no-provider-columns and deferred-understanding guidance above. See [revised section reference](../product/ai-brand-perception/sections/clear-concise-complete/model-comparison.html).

