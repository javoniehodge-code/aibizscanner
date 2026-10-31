# Location Analysis Report — schema and content specification

Version 1.0 · 31 October 2026

Status: product/design specification, not implemented functionality or a live Target audit. The seven-section structure and owner-website baseline reflect the discussion. Extraction, scoring, and storage details below are proposed implementation defaults unless already governed by the shared contracts.

## Purpose and shared contracts

Help a multi-location operator identify which branches AI overlooks, what information is incorrect, and whether headquarters or a location manager owns the fix.

This remains the Location Analysis Report. It reuses the [AI Prompt Analysis generation guidelines](visibility-prompt-guidelines.md), [answer/evidence schema](visibility-report-schema.md), and [discrepancy checklist](brand-evidence-and-checklist.md). Shared prompts and observations must retain their original IDs; reused answers are not independent scans. The report adds branch identity, comparable geographic prompt families, portfolio comparisons, and action ownership.

ChatGPT, Claude, Gemini and Perplexity must remain visibly distinguishable. MVP is English only. A pooled figure never replaces per-provider evidence. API results are not exact replicas of the consumer apps. Location refresh cadence remains monthly or twice monthly under existing product decisions; this document does not select a cadence or create a subscription entitlement.

## 1. Owner website is the factual baseline

Use the owner's website as the report's source of truth for branch roster, identity, hours, address, phone, offerings, service coverage, and published policies. Preserve each page URL, exact supporting excerpt, retrieval date, and snapshot/version. Distinguish brand-wide policy from branch-specific facts; do not apply an offering to every branch merely because it appears on a general fleet/service page.

- Compare external listings and AI claims against the website and show the disagreement explicitly.
- Website silence means unknown, not false. A branch absent from the directory is not thereby proven closed.
- Conflicting official pages produce an unresolved website inconsistency; do not silently pick the convenient value.
- A business label may differ from its postal municipality. Preserve the branch's website label, address, aliases, and service area separately; that difference alone is not an error.
- Owner input can flag a website correction but must not silently replace the published baseline. Keep owner-submitted claims separate until the website or a new explicit baseline rule supports them.
- This baseline defines report comparisons; it does not guarantee that every website claim is independently correct.

### Target example provenance

The original discussion described nine branches. The website directory retrieved on 23 October 2026 listed ten: San Juan, Barceloneta, Bayamón, Caguas, Caparra, Cayey, Humacao, Ponce, Guaynabo, and Mayagüez. The saved example follows that directory rather than hard-coding nine.

- Baseline: https://www.targetrentacar.com/locations/
- Conflicting external listing: https://www.discoverpuertorico.com/profile/target-rent-car/1577 — described eleven and included Fajardo during the original check.

These are dated observations from the design exercise, not a fresh verification on this document's publication date. Re-fetch sources before a real report. Do not infer closure or relocation from the count mismatch. The visual's AI scores, rivals, issue counts, descriptions, and actions are synthetic; no four-provider audit or review/profile audit has been performed.

## 2. Required report sections

### 1 — Portfolio scorecard, first page

Start with a short executive summary followed by one row per website-listed branch, sorted lowest visibility first. Use alphabetical tie-breaking. Flag high-impact accuracy/routing errors prominently without concealing the sort rule.

| Field | Display / meaning |
| --- | --- |
| Location | Website label; opens branch details |
| AI visibility | Correct-branch recommendation percentage and numerator/denominator |
| Core local prompt | Exact approved category-and-place question, with results for all four providers |
| Leading competing branch | Most often recommended alternative in that branch's comparable usable answers; count, denominator, and evidence |
| Open issues | Distinct unresolved issues affecting this branch; link to issue records |
| Completion | Expected, usable, failed/unavailable, and identity-unresolved responses |

Keep brand-only mentions separate from correct branch recommendations. Show missing provider results rather than manufacturing zeros. A rival may lead in frequency without being explicitly ranked above Target; label it accordingly. Headquarters issues affecting multiple branches count once in the portfolio issue total and once in each affected branch's count; do not sum branch counts as unique portfolio issues.

### 2 — Buyer-prompt heatmap

Locations form rows; equivalent intent families form columns. Use the same neutral template with the local geography substituted. Each cell expands to all four providers, exact prompt, original answer, extracted identities, recommendation status, citations, and errors.

Keep these dimensions separate in storage even if the UI summarizes them:

- Correct branch recommended.
- Correct branch named without a recommendation.
- Brand only, with branch unspecified.
- Missing from a usable, identity-resolved answer.
- Wrong branch or website-conflicting fact, with supporting evidence.
- Unknown identity, unavailable answer, or not applicable.

A recommended branch can also have a wrong-hours claim. Preserve both; an error flag must not erase the recommendation or silently change the scoring rule.

Suggested Target demonstration families: general local rental, affordable rental, family/minivan rental, monthly rental, and Sunday pickup. These five illustrate layout, not verified customer demand or a fixed requirement for every rental branch. Do not penalize correct exclusion for a service the branch does not offer. If eligibility is unknown, disclose it and exclude it from the comparable score until resolved.

Use applicable shared families for portfolio comparisons; show specialist airport/commercial prompts separately when only some branches qualify. Do not manufacture a full offerings × locations matrix. For adjacent-area discovery, apply the shared guideline to a small purposeful set (for example, 2–5 nearby-area questions), label confirmed versus exploratory service coverage, and keep them distinct from home-area performance.

Preserve observed answer order and ordered names under the shared AI Prompt Analysis contract. Position means appearance order, not a guaranteed preference rank. Do not infer rejection reasons from absence or include branded follow-up explanations in neutral discovery counts.

### 3 — Brand-wide versus location-specific fixes

| Headquarters | Location manager / branch team |
| --- | --- |
| Shared policy/service-page clarity | Branch hours, address, phone and local pickup information |
| Brand-name/entity confusion | Wrong branch attribution or merged listings |
| Shared directory or naming standards | Local listing categories and factual completeness, where actually checked |
| Airport service explanation and central templates | Branch-specific offerings and website-aligned local information |

Every issue has one accountable owner role, optional collaborators, affected branches, evidence, concrete action, verification rule, and status. Assignment is organizational guidance; the report does not send messages or alter external listings.

Use Open; Owner marked done—awaiting verification; Verified complete; Could not verify. Keep source correction and subsequent AI-answer correction separately verifiable. Owner checkmarks alone do not resolve a measured discrepancy. Failed checks leave issues open; recurrence can reopen a task. Strategic actions without objective checks remain explicitly owner-completed rather than automatically verified.

### 4 — Accuracy errors

Capture wrong hours, phone, address, branch status, location merging, branch routing, inconsistent naming, and incorrect offering/policy claims. For rental businesses, distinguish airport service, shuttle pickup, and an airport counter; they are not interchangeable. Do not invent current vehicle inventory or infer availability from a fleet category.

Each error record needs the exact website baseline and URL/date, conflicting source or answer excerpt/date, provider/model when applicable, affected branch, error type, uncertainty, impact, owner, and linked tasks. Distinguish a third-party discrepancy from an AI error; the former does not establish that a tested model repeated it. Wrong-branch classification requires a supported geographic/service mismatch, not merely that the named branch is farther away.

### 5 — Strongest comparable branch as a template

Select a stronger branch within comparable prompt eligibility, service model, and sufficient response coverage. Compare branch-page specificity, available review volume/recency, review language about the actual experience, checked profile fields, and cited external coverage. Mark unavailable review/profile data honestly.

Output: weaker branch, reference branch, observed difference, evidence, transferable action, and limitations. Different markets and airport access can explain performance differences; do not promise that copying a page or obtaining reviews will reproduce the stronger score. Treat possible explanations as hypotheses, not causal findings.

### 6 — Local competitor per branch

Alternatives emerge from model answers, not an owner-picked competitor list. Resolve competing branches separately from their parent brands. Show frequency by provider, prompts where the rival is recommended and Target is not, ordered-answer evidence where meaningful, explicit stated reasons, and linked source evidence.

Example output format: “In [area], [rival branch] was recommended in X/Y usable answers; Target in A/Y.” Add review or service differences only when directly checked. Never assert that a review-count advantage caused the result. No local rival, insufficient evidence, and unresolved identity remain valid states.

### 7 — Coverage gaps

Separate three findings: an eligible existing branch is overlooked; AI routes a customer to an inappropriate branch; an area lies outside website-confirmed coverage. Identify geography, tested needs, providers, returned alternatives, relevant branch/service evidence, and next action.

Absence of documented coverage is not proof that service is unavailable. A visibility gap is not evidence of search volume, unmet demand, or a profitable new branch. Expansion findings are leads requiring independent demand and economic validation.

## 3. Branch detail and cited sources

Opening a scorecard row shows branch facts, website links, prompt results, short descriptions/associations for each AI, observed rivals, issues, actions, and comparable history. Show exact citations by location and provider, grouped using the shared AI Prompt Analysis source taxonomy: company websites; maps/places; reviews; directories/marketplaces; editorial; communities/social; official/professional; other/unclassified. Preserve the target website versus competing company website distinction.

Deduplicate a cited page/domain within an answer when counting frequency; preserve raw annotations. Unavailable citation metadata is not proof that the model used no sources. Follow-up retrieval is a source check, not a new discovery response. Shared brand facts are visible once as the baseline while provider-specific portrayals and disagreements remain visible.

## 4. Scoring, denominators, and history

Proposed score: correct-branch recommendations / usable, eligible, identity-resolved observations × 100. Show numerator and denominator, per-provider counts, distinct prompt count, and sample counts. Unknown identities and failed requests are excluded and visibly disclosed, never treated as misses. A substantive answer recommending no businesses remains a usable non-recommendation when eligible. Zero denominator means unavailable, not 0%.

Keep factual accuracy separate. If a model recommends the correct branch but states incorrect hours, retain the recommendation and error independently. The visual's compact C/B/—/W fixture is only a simplified UI illustration; production requires separate identity, recommendation, accuracy, and execution fields.

For fair ordering, use a shared applicable family subset and equal configured provider/sample coverage. Where eligibility or completion differs, show partial/comparability warnings; do not imply equivalent performance from unequal mixes. A pooled score summarizes the tracked answers, not all AI searches or market share.

Store dated immutable snapshots. Compare only compatible branch identities, prompt wording/families, eligibility, language, sampling, provider/search configuration, and extraction rules. Flag changed model versions, baseline changes, and new/closed/moved branches. Preserve per-provider changes; reclassification is not new model behavior. Sampling repetitions remain governed by shared decisions, not resolved here.

## 5. Logical data schema

Storage-independent extension of the shared answer/evidence contract; not a database migration.

| Record | Required fields / relationships |
| --- | --- |
| LocationReport | report_id, schema_version, business_id, baseline_snapshot_id, branch_ids, prompt_set_version_id, run_ids, language, timestamp, completeness, limitations, comparison_report_id |
| Branch | branch_id, brand_id, website_name, aliases, canonical_page, address/municipality, contact, status_basis, service_area, offerings, policy_scope, baseline_fact_refs |
| BaselineFact | fact_id, branch_id or brand scope, field, published_value, source_url, excerpt, retrieved_at, snapshot_id, conflict/unknown status |
| GeographicPromptVariant | prompt/version IDs, intent_family_id, branch_id, explicit_area, exact_text, eligibility and baseline refs, home/adjacent/specialist group, demand evidence, language |
| BranchAssessment | answer_id, expected_branch_id, resolved_branch/entity IDs, identity_status, recommendation_status, appearance_order, brand_only, accuracy_findings, extraction version |
| AccuracyFinding | finding_id, branch_ids, error_type, baseline_fact_refs, conflicting answer/source refs, observed_value, uncertainty, impact |
| CompetitorObservation | answer_id, competing_branch/entity_id, parent_brand_id, recommendation/appearance/order, evidence spans |
| SourceReference | answer/citation/source IDs, branch association, provider, URL, category, annotation availability, retrieval/check refs |
| IssueTask | task_id, finding_refs, owner_role, collaborators, scope, affected_branch_ids, action, priority basis, state, verification_rule, last_check/history |
| BranchComparison | weaker/reference branch IDs, comparable family scope, factor, checked evidence, transferable action, hypothesis and limitations |
| CoverageGap | geography, prompt/answer refs, applicable branch refs, coverage basis, visibility/routing/undocumented-coverage type, next investigation |

Raw responses, provider/model IDs, settings, timestamps, citations, and failures remain stored under the shared contract. A report section must never invent a separate untraceable dataset.

## 6. Visual reference and acceptance

- [Interactive Target example](location-analysis/target-portfolio.html): standalone HTML, download and open in a browser.
- [Editable visual source](location-analysis/target-portfolio-source.html): the fragment used to generate the standalone copy.

The saved visual preserves the four-tab layout: Portfolio scorecard; Prompt heatmap; Issues & ownership; Branch playbook. The last tab groups branch details, internal template, local rival, and coverage-gap guidance. It is a sample interface rather than complete implementation of every field in this specification.

Use black text on white backgrounds, including all supporting text and status labels, under the latest visual standard. Use symbols, explicit labels, borders, and black bars rather than colored text. No gray text. All interactions must work without the conversation host.

Acceptance checks:

1. Baseline roster follows the website; conflicting external facts are recorded, not silently merged.
2. Every branch result traces to approved prompts and original observations across all four providers.
3. Correct branch, brand only, missing, errors, unknowns, unavailable, and not-applicable states are distinguishable.
4. Scorecards, heatmap, and branch detail use the same counts and explicit denominators.
5. HQ and branch actions have evidence, ownership, and verification; checkmarks do not claim resolution.
6. Rival/reference-branch explanations and coverage leads disclose causal/demand limitations.
7. All synthetic example results are labeled. Dated published-source observations are not presented as fresh audit findings.
8. No pricing, cadence, language expansion, or production functionality is implied by the mockup.
