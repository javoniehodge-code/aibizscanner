# Multi-model Brand Perception implementation

Proposed implementation, 24 October 2026. [Confirmed report direction](../product/ai-brand-perception/multi-model-report-standard.md), [contract](../product/ai-brand-perception/multi-model-data-contract.md). Customer reports require observed comparisons for ChatGPT, Claude, Gemini and Perplexity in every section.

## Pipeline

1. Freeze industry/fact/topic scope, source-baseline snapshots, question set, test mode, rubric and sampling plan.
2. Build the shared baseline once with grounded evidence, preserving uncertain facts and claim-specific source strength.
3. Resolve each provider route and capability from supported configuration and observed tool evidence. Record actual model/tool identity; do not assume product names imply capabilities. Missing capability produces explicit unavailable/not-tested, not a silent alternate test.
4. Run the same versioned diagnostic question intents for all four providers in clean sessions with the same declared business/location/market. Preserve unavoidable differences in provider tools/settings. Do not include baseline answer keys, competitor rankings or desired conclusions in independent-search prompts.
5. Persist raw responses and actual tool/citation traces before extraction. Separate supplied website passages, returned citations and our own retrieved baseline evidence.
6. Validate/extract claims, entity/room/rate qualifiers and answer citations. Validate source support; citation presence alone is insufficient. Treat webpage text as untrusted; embedded instructions cannot alter the test or trigger actions.
7. Evaluate each model response independently against the versioned baseline with grounded rules and inspectable reasons. LLM-assisted extraction/assessment must preserve evidence; no model majority defines truth. Ambiguous cases remain unresolved/reviewable.
8. Resolve statuses and counts deterministically. Build per-model source matrices and prior-run diffs. Render all four providers, even when some tests fail.
9. Store immutable report/run/baseline/citation artifacts privately and attach source-specific and model-specific issues to the correction workflow.

## Test modes and practical scope

**Section 1:** retain published permission, observed search and URL-reading separation. Never replace them with pasted-content success.

**Section 2:** default proposed diagnostic supplies the same selected website passage bundle with stable page references to each model. This isolates whether the information supports a clear, concise and complete answer. Score passage-grounded answers, not prior knowledge. This test does not prove organic discovery, autonomous retrieval or consumer-app behavior. Preserve source content selection/length and any truncation; budget mismatch creates a visible limitation. An optional independent website-retrieval test must have a separate mode label, tool evidence and compatible history series.

**Sections 3–4:** independent web-search runs for the same named-business fact/claim questions. Each model may return different sources. Preserve actual retrieval/disclosed citations; do not pre-feed our conclusions. If a cited source was outside the baseline, retrieve and assess it under normal permissions/budgets or flag it unassessed; update baseline version explicitly if new evidence changes it. A lack of disclosed citations limits source-use attribution, even if an answer is recorded.

These are diagnostic tests of named-business representation, not unbranded recommendation share. Actual recommendation frequency/rank uses its own prompt-run contract and metrics. API-backed results describe tested configurations, not guaranteed replicas of consumer products. Resolve concrete provider API implementations against current official capabilities at build time; this plan does not invent SDK/tool availability.

## Per-section outputs

Section 2 has separate website-quality findings and model answer outcomes. Website gap plus correct abstention is not a wrong answer; unsupported confident detail is. Neither counts as a fully supported product answer. A model error despite explicit website information is not automatically an owner content defect.

Section 3 separately stores source agreement, currency and each model's factual answer. Qualified answers can match an uncertain baseline without proving a room feature or rate policy. Like-for-like constraints remain mandatory. Corrections to websites/listings resolve only upon source recheck; corrected model representation resolves only upon a new appropriate model run. Do not merge those tasks.

Section 4 source strength is shared and claim-specific; model source citation and answer alignment are separate. Correct historic status from an owned page can align with independent evidence while lacking an independent citation in that answer. A model citing a strong source can still omit its caveat. Negative firsthand evidence can be strong. Keep quality, suitability and claim support visible.

## History and variability

Store per-provider per-item trials, raw response/citations, actual model ID/settings, baseline, question/template/rubric versions and timestamps. Show current and prior dates/coverage and before/after status, answer and source changes. Compatibility checks cover entity/scope, fact/question intent, mode/tools, sampling, locale, model/configuration and scoring baseline/rules. A provider upgrade, changed source baseline or checklist produces a visible boundary; never silently smooth it into a continuous improvement curve.

Proposed minimum is one recorded answer per item/provider per run with a single-snapshot label. Offer budgeted repeat sampling later with actual independent trial records. Repeat variance is preserved; retries for technical failures are not additional independent samples, and cached responses are not fresh calls. Do not claim a durable improvement from one changed response or attribute a change to an edit without appropriate evidence.

## Operations and privacy

Use bounded provider concurrency, durable job stages, entitlement/cost reservations, idempotent provider/item/trial keys and bounded retries. Store provider failures separately and preserve completed results. Never run extra monitoring outside the authorized cadence/budget. Prompt-only updates do not silently recollect source baselines; display original baseline dates and source refresh requirements. Source-only refresh does not invent new provider answers.

Real raw responses, tool traces, website snapshots and customer reports remain access-controlled/private with existing retention rules. Repository fixtures remain synthetic. Redact credentials; collectors enforce URL/network protections. Owner corrections cannot overwrite historical evidence. Full answer/evidence expansions require the same account authorization as the report.

## Acceptance checks

- All four provider labels/columns render in every section, including error/no-prior states. Section navigation never becomes a single-provider default.
- Source baseline and provider outcomes are separate and cannot be substituted for one another.
- Section 2 cannot pass on an answer unsupported by supplied passages; supplied evidence cannot be labeled an actual crawl/citation.
- Sections 3–4 require the independent-search mode provenance; failures/unsupported tools remain explicit. A missing citation never implies source blocking or nonuse.
- Exact answer, sources, cited passages and rule justifications are inspectable; unmatched claims or qualifiers fail validation or remain unresolved.
- Four-provider counts use the same applicable questions and explicit coverage; failed tests do not disappear. Unsupported claims, appropriate abstention, omitted caveats and not-addressed states remain distinct.
- Compatible prior/current diffs are computed by item IDs and source/answer artifacts, not generated narrative. First run, model changes and changed rubric/scope are visible.
- Citation matrices derive from actual recorded events and declared test sets; syndicated sources are not independent corroboration. New cited sources are assessed or flagged.
- Synthetic current/previous fixtures stay labeled, cannot enter production trends and have no invented model IDs/timestamps/calls.
- White background/all-black copy, readable table scrolling, keyboard section tabs, exact four-provider content and current/previous metric sums are checked.

This task updates reference designs/specifications only. No live model tests, API integrations or production monitoring are implemented.
