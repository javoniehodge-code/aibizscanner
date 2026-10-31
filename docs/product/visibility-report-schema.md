# AI Visibility Report — report schema and content specification

Version 1.0 • 31 October 2026
Status: product specification, not implemented functionality. Confirmed requirements and proposed implementation defaults are distinguished below.

## 1. One product, from prompt generation to report

**AI Visibility Report is the product name. “AI Prompt Analysis” is an earlier name for the same product, not an additional report, separate purchase or separate analysis workflow.** The prompt analysis table is the report's central evidence view; the other sections summarize and explain those same observations.

The [Visibility Report prompt generation guidelines](visibility-prompt-guidelines.md) govern how questions are researched, generated, selected, approved and versioned. This document governs how their executed results are stored, aggregated and presented. Neither document replaces the other.

End-to-end flow:
1. Build the factual business brief and gather available demand evidence.
2. Generate, select and approve neutral questions under the linked guidelines.
3. Freeze the approved prompt-set version and execute it across ChatGPT, Claude, Gemini and Perplexity.
4. Preserve original answers and citations; identify the target and other named businesses after execution.
5. Derive positions, appearances, recommendations, competitor frequencies and source categories from those observations.
6. Present one AI Visibility Report with six sections, answer-level evidence and an action checklist.
7. Reuse compatible approved questions for later runs; preserve dated snapshots and explicit series boundaries.

Do not generate separate, untraceable datasets for the executive summary, competitor chart or brand summary. Additional retrieval to investigate sources is a separately recorded evidence check, not another discovery observation.

The report helps owners understand:
- Whether they appear for general category questions.
- Which actual products or services they are chosen for or overlooked for.
- Whether adjacent customer needs lead to their business or alternatives.
- Who else appears, where the target appears in the answer, and what each AI explicitly says.
- Which source types and websites are cited.
- Which supported discrepancies or opportunities warrant action, and how dependable the sampled results are.

Customer profiles, personas and demographic comparisons are excluded for now. Owners do not choose competitors for this report; alternatives emerge from executed answers.

## 2. Scope and shared report shell

| Element | Required contents |
| --- | --- |
| Identity | Report ID/version, business name/domain and matching identity |
| Scope | Category, offerings, language, explicit market/location and approved prompt-set version |
| Execution | Run timestamps, provider labels, actual model IDs, execution/search configuration and sample counts |
| Completeness | Expected, usable, unavailable, pending and identity-unresolved counts; partial status clearly visible |
| Prompt provenance | Bucket, intent, wording/version, approval and observed/supported/exploratory demand label |
| History | Previous compatible run when available; otherwise “No previous comparison” |
| Evidence access | Original answers, citation annotations, exact linked source pages and dated checks |
| Export | Web report first; PDF and optional requested email use the same snapshot and definitions |

All four providers remain visible, including failed or untested providers. Use direct provider APIs under existing architecture; no OpenRouter or Google AI Overviews in MVP. Disclose that API outputs are not exact replicas of consumer applications.

The free report uses five approved prompts from the same generation process and the same evidence structure. Expanded generation targets 25–50 useful prompts, not a confirmed paid entitlement. Do not manufacture weak prompts to reach a count. Pricing, sampling repetitions, retention and other commercial rules remain governed by existing decisions; this specification does not resolve them.

Prompt monitoring remains three times weekly under the existing product direction. A purchased snapshot does not imply a monitoring subscription.

### Visual and accessibility requirements

Use **black text on white backgrounds throughout every report visual**, including headings, table headers, labels, citations, footnotes, status text and supporting explanations. Do not use gray text or colored text.

Differentiate the target business using bold text, a visible “Your business” label, an outline or a black marker. This latest black-only instruction supersedes the earlier suggestion of a distinct text color. Use black chart bars; outline or label the target bar. Use spacing, borders and typography for hierarchy, not low-contrast text.

Keep the language understandable to a nontechnical business owner. Put technical metadata and detailed rules behind expandable controls. Tables must work on mobile without clipping essential content. Controls must be keyboard accessible; status cannot depend on color.

## 3. Required sections

### 1. Executive summary

Lead with a short, evidence-supported finding, followed by counts with explicit denominators.

Include:
- Total distinct questions, coverage by baseline / products and services / adjacent needs, and models tested.
- Named and recommended counts shown separately, with usable-answer denominators.
- Per-provider comparison with missing results visible.
- Strongest observed offering or prompt group and material gaps, with links to underlying questions.
- Recurring alternatives and source-use patterns when sufficiently supported.
- The most important supported discrepancy or next step.
- Sample/dependability limitations and previous/current changes only where comparable.

Do not invent an overall grade, market share, search-demand coverage or causal explanation. An overall pooled count is an answer-level summary, not a count of distinct customer opportunities. Unequal provider completion changes the composition of pooled results; disclose that and keep provider counts visible.

### 2. Prompt analysis: positions and ordered names

Rows are approved customer questions; columns are ChatGPT, Claude, Gemini and Perplexity. Preserve prompt groups, wording, market and evidence labels.

Provide a **Positions / Business names** toggle over the same observations.

#### Positions view

| Observation | Display example |
| --- | --- |
| Target first among five distinct named businesses | 1st of 5 named |
| Target second among three | 2nd of 3 named |
| Target absent; five other businesses identified | Not named · 5 others named |
| Target present but no reliable linear order | Named among 5 · order unclear |
| No relevant businesses named in a usable answer | No businesses named |
| Identity cannot be resolved | Identity unclear |
| No usable answer | Answer unavailable, with reason |

**Position is observed answer order, not a claim of preference, quality or an independently established rank.** Preserve explicit ranking statements separately. If the answer is grouped, tied or non-linear, do not flatten it into a false preference order.

Proposed extraction defaults:
- Count unique relevant business entities in the original answer, not repeated occurrences, source publishers or incidental names.
- Use the first substantive appearance in a clear linear answer to determine appearance order.
- Preserve recommendation, neutral mention, negative mention, explicit exclusion and ambiguity as separate attributes.
- A negative mention can have an appearance position; its concern/exclusion label must remain visible.
- Do not infer that every named entity is recommended. Informational adjacent answers may appropriately name no providers.
- An unresolved name must not silently inflate the named count or turn into target absence. Retain ambiguity and disclose that counts may be incomplete.
- Never ask the model to return an arbitrary fixed number of names just to simplify the table.

#### Business names view

Show each answer's extracted names in original order, with the target in bold and labeled “Your business.” Preserve grouped structure where no single order exists. Keep recommendation/concern labels accessible. The toggle changes presentation only; counts and evidence remain identical.

Each cell expands to:
- Exact question and original complete answer.
- Extracted business names, matching status, appearance order and recommendation labels.
- Citation links and available annotation-to-text associations.
- Provider, actual model, timestamp, search requested versus observed, and sample identifier.
- Explicit reasons or concerns, with answer excerpts; absence alone has no inferred rejection reason.

If more than one sample exists for a prompt/provider pair, expose sample selection and named/recommended frequencies. Do not combine different lists into one invented ordered answer or hide variation behind an unexplained average position.

### 3. Competitor appearances

Show a **horizontal bar chart sorted highest to lowest** by how often each business was named in the selected answers. Include the target as a clearly labeled comparison bar.

Required chart behavior:
- Default metric: named in distinct usable answers.
- Count each normalized business once per answer, even if it appears repeatedly.
- Show count and denominator, such as “12 of 19 answers.”
- Support All AIs / individual provider selection.
- Selecting a business reveals the questions, providers, positions and answer evidence where it appears.
- Preserve eligible but unresolved identities separately; do not merge same-name businesses without evidence.
- Use a stable alphabetical tie-break where counts are equal.

Proposed enhancement: a Named / Recommended metric toggle. Named is the confirmed default; recommendation counts must remain distinguishable elsewhere even if this extra control is deferred.

Label the section “Businesses named most often” or equally plain language. Named frequency is not market share or proof of endorsement. The section includes observed alternatives, which may be from different categories for adjacent questions. It is part of this Visibility Report, not the separately sold Competitor Analysis Report, whose deeper assessment remains distinct.

A recommendation gap means a usable, identity-resolved answer recommends an alternative but not the target. Keep mention-only differences and answers with no recommendations separate.

### 4. Where AI gets its information

Replace the flat “Top cited websites” section with **source-category analysis**, visible for each provider.

Proposed initial taxonomy (bucket analysis is required; the complete taxonomy remains an editable implementation default):

| Category | Includes |
| --- | --- |
| Company websites | Target's website, competing/alternative businesses' sites; explicitly separate “Your website” from “Other company websites” |
| Maps & places | Map results, place profiles and location listings |
| Review platforms | Customer-review platforms and relevant industry review pages |
| Directories & marketplaces | Business directories, booking platforms, retailer/marketplace listings and service marketplaces |
| Editorial & specialist publications | News, local guides, specialist coverage, independent articles and comparisons |
| Communities & social platforms | Forums, public discussions, social posts and community content |
| Official & professional sources | Government, licensing bodies, professional associations and certification organizations |
| Other / Unclassified | Sources outside the taxonomy or insufficient evidence to categorize |

Categorize the cited page's role, not just its domain. A mixed platform can contain reviews, listings and editorial articles. Assign each page one primary category with classification evidence/confidence; do not count one citation in several buckets. Preserve unclassified sources honestly. Version the classification rules so historical category changes are not misreported as changed AI behavior.

At category level show:
- Per-provider count of usable answers citing the bucket and usable-answer denominator.
- Citation availability/coverage by provider, including unavailable citation metadata.
- The top domains in the bucket, sorted by distinct-answer reference frequency.
- Expandable exact pages, links, counts and the answers referencing each page.
- Target versus other company website distinctions.

Counting rules:
- A category counts once per answer even if several of its pages are cited.
- A domain counts once per answer within its bucket; a page counts once per answer.
- Preserve raw repeated annotations but do not inflate frequency with them.
- An answer can cite several buckets, so category counts/percentages need not sum to the total/100%.
- The same mixed domain may appear under different buckets for different pages; an overall domain count must deduplicate across those buckets.
- Distinguish confirmed citation metadata, plain URLs in answer prose, and independently retrieved pages. A prose URL is not automatically a confirmed citation.
- “No citations returned,” “citation metadata unavailable,” and “answer unavailable” are separate states. Lack of exposed citations does not establish lack of source use.
- Citation counts describe references observed in sampled answers, not all information used internally by a model.

Customer interpretation: “Review platforms were cited in 8 of 19 usable answers.” Do not turn this into “Reviews caused your ranking” or “42% of AI's decision comes from reviews.”

### 5. Brand summary

Provide a brief, visibly four-provider comparison of the factors explicitly associated with recommending, mentioning or expressing concerns about the business.

For each provider include:
- Recognized offerings and stated reasons to choose the business.
- Explicit concerns, exclusions or factual discrepancies when present.
- Questions and answer excerpts supporting each finding.
- Source links when the answer provides them.
- “No explicit reason given” for omissions without stated explanations.
- Unavailable or insufficient evidence states.

Keep observed statements, source-checked facts and our suggested interpretations separate. A follow-up asking “why did you omit X?” is named-business analysis, not an original discovery observation; label it and exclude it from discovery counts.

This is a concise synthesis of the tested answers. It does not replace or silently include the full five-section AI Brand Perception Audit.

### 6. Action checklist

Prioritize supported findings rather than emitting generic advice. Each item needs:
- A specific observed issue or clearly labeled opportunity.
- Affected prompts/providers and linked answer/source evidence.
- Observed value versus factual baseline, baseline provenance and confirmation date where relevant.
- A concrete action and explicit verification method.
- Priority rationale, task state, last check and history.

Keep source corrections and changed AI representation as separate tasks. Owner confirmation does not rewrite historical source or answer values.

Use the existing [checklist contract](brand-evidence-and-checklist.md): Open; Owner marked done—awaiting verification; Verified complete; Could not verify. Non-verifiable strategic ideas may be Owner completed, explicitly separate from automated verification. Failed or missing checks do not close tasks; recurring discrepancies can reopen them.

Do not promise that a source edit will create recommendations or establish causality from one changed answer.

## 4. Logical data schema

This is a storage-independent contract for design and engineering, not a database migration or prescribed table layout.

| Record | Key fields / relationships |
| --- | --- |
| VisibilityReport | report_id, schema_version, business_id, prompt_set_version_id, run_ids, snapshot_at, language, market_scope, section aggregates, completeness, comparison_report_id, limitations |
| ApprovedPrompt | prompt_id, version, intent_family_id, exact_text, bucket, pattern, offering_or_need_id, market, language, evidence_status, evidence_refs, approval, display_priority |
| PromptSetVersion | set_id, version, approved_prompt_versions, approval_time, generation_guideline_version, source/input versions |
| ExecutionRun | run_id, prompt_set_version_id, configuration_version, started_at, completed_at, status, expected_attempts, report_window |
| AnswerObservation | answer_id, run_id, prompt_version_id, provider, actual_model_id, sample_index, request/execution settings, search_requested, search_observed, timestamp, status, usable, raw_answer, failure_reason, extraction_version |
| BusinessEntity | entity_id, canonical_name, domain, aliases, locations, entity_scope, identity_evidence; target linkage |
| BusinessAppearance | answer_id, entity_id or unresolved candidate, raw_name, source_span, appearance_order or null, order_basis, recommendation_status, explicit_rank or null, explicit_concern, match_status |
| CitationAnnotation | citation_id, answer_id, provider annotation, raw_url, normalized_page_id, linked_answer_span if supplied, metadata_status |
| SourcePage | page_id, canonical_url, domain_id, title, primary_category, category_rules_version, classification_basis/confidence, company_relation |
| SourceCheck | check_id, page_id, retrieved_at, retrieval_status, observed_content/evidence, freshness/verification limitations |
| Finding | finding_id, kind, provider_scope, prompt/answer/source refs, observation, baseline_ref, interpretation, limitations |
| ChecklistTask | task_id, finding_refs, task_kind, action, priority_basis, state, verification_rule, last_checked_at, completion/reopening history |

Preserve brand versus branch identity deliberately. Do not merge distinct locations just because they share a brand, or split aliases of the same entity without reason. Record unresolved identity instead of forcing a match.

Recommended enums:
- Prompt bucket: baseline / product_service / adjacent.
- Demand evidence: observed / supported / exploratory.
- Execution: queued / running / completed / partial / failed / not_tested.
- Recommendation: recommended / mention_only / negative_mention / explicitly_excluded / ambiguous.
- Target assessment: named / absent / identity_unresolved / no_businesses_named / answer_unavailable.
- Order basis: explicit_rank / linear_appearance / grouped_or_unclear.
- Citation metadata: available / none_returned / unavailable.

An answer can contain multiple contextual mentions; preserve supporting spans and conflicting statements rather than forcing all nuance into a single label.

## 5. Aggregation and history rules

- Primary counting unit for appearances and references: a distinct usable answer observation, not raw mentions, citation annotations or distinct prompts.
- Also disclose distinct prompts and samples per prompt; repeated samples do not create new customer opportunities.
- Provider-specific denominator: substantive usable answers in the selected scope. Failures, empty answers and refusals are unavailable; substantive answers naming no businesses remain usable.
- Track ambiguous identity separately. A usable answer with unresolved target identity is not proven target absence; expose resolved classification coverage alongside named counts.
- Overall aggregates pool answers only when scope is compatible and explicitly labeled. Never combine languages or incompatible prompt/configuration versions into an unexplained metric.
- Use one canonical observation once; retries and reused evidence must not count as independent new samples.
- All sections share the same run/window/provider/prompt scope. An unavailable answer supplies no competitor or citation evidence.
- Preserve old report snapshots. Wording, location, language or materially different execution configuration creates a visible comparison boundary.
- Position changes are meaningful only with their full answer context and named-list sizes. “2nd of 3” versus “3rd of 10” is not automatically an improvement.
- More samples and compatible repeated runs help assess variation; one snapshot does not prove stability, causality or future recommendation probability.

## 6. Acceptance criteria

1. The product is labeled AI Visibility Report. Prompt generation, execution and the six report sections are documented as one workflow.
2. The generation guideline is linked in both directions, without duplicating or contradicting its selection rules.
3. The report shows all four providers and preserves unavailable states and real model metadata.
4. Position cells support “1st of 5 named,” “2nd of 3 named” and “Not named · 5 others named,” plus unclear/no-names/unavailable states.
5. Switching Positions / Business names preserves observations and shows original ordering; target identity is distinguished in black-only styling.
6. Mention, recommendation and concern remain separate from appearance order.
7. The competitor bar chart sorts named-answer frequency descending, includes the target and exposes underlying questions and providers.
8. Source categories show per-provider counts, top domains, pages and answer references, with deduplication and missing-metadata rules.
9. Summary totals reconcile to answer observations; unavailable and identity-unresolved results cannot silently become absences.
10. Brand findings and actions link to evidence; unexplained omission is not assigned a fabricated cause.
11. Source fixes and AI discrepancy verification remain separate, with no completion from an owner click alone.
12. Every visible text element is black on white. No gray text, color-only status or colored target name.
13. Illustrative fixtures are labeled invented; unimplemented data collection, verification and historical improvements are not presented as live.
14. Free and paid use the same report contract; commercial caps and sample repetitions are not invented here.

## 7. Remaining implementation choices

- Finalize source-category boundaries and validate page-role classification on mixed platforms.
- Validate extraction rules for grouped lists, incidental mentions, branch identities and conflicting answer statements.
- Choose sampling repetitions and multi-sample cell presentation within disclosed cost/plan limits.
- Decide whether to ship the proposed Named / Recommended chart toggle initially.
- Validate responsive layout and black-only target emphasis.

These choices do not create additional products or reopen the confirmed six-section structure.
