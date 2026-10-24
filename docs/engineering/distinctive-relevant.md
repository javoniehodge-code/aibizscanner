# Section 5 implementation: Distinctive & relevant

Proposed technical process, 24 October 2026. [Section reference](../product/ai-brand-perception/sections/distinctive-relevant/README.md), [contract](../product/ai-brand-perception/sections/distinctive-relevant/data-contract.md). Follow the [shared four-model pipeline](multi-model-brand-perception.md).

## 1. Establish an evidence-based baseline

Reuse selected readable website/source snapshots and prior section evidence where scope/freshness permit. Identify supported tools/capabilities, relevant audiences, limitations and plausible reasons the features help a user. Preserve exact page/claim scope and uncertainty. Do not require owner positioning or accept desired identity as ground truth.

Five evaluation dimensions are category, user fit, reasons to choose, competitive distinction and missing/misleading associations. Select a bounded, relevant association inventory before the run; preserve meaningful supported attributes and important mischaracterization risks. The example's five associations are not a new universal calculator standard or a replacement for the 5–10 decision-fact standard in Sections 2–3.

A formula explanation supports transparency, not verified mathematical correctness. A user-adjustable waste allowance does not guarantee less waste. Individual material calculators are not complete job-estimating/bid-management software. Assess identity associations without inventing engineering capabilities.

## 2. Freeze neutral diagnostic questions and provider settings

Default proposed exercise: five named-site questions on offering, audience, reasons to choose, alternatives and limits. Do not embed the feature list, desired associations, competitor superiority or baseline answers. Use the same intent and business/context for all four providers, fresh sessions, independent web search where the configured route actually supports it. Record actual model/tool settings, full prompts, raw answers, dates and tool/citation traces. Unsupported routes remain explicitly unavailable; no silent supplied-evidence substitute.

One recorded answer per question is a disclosed snapshot, not a stable estimate of model beliefs. Additional independent trials need explicit budget and sampling metadata. Questions ask about a named site; spontaneous recommendation inclusion/rank requires a different unbranded prompt experiment and metric.

## 3. Extract associations from actual answers

Extract candidate phrases, exact answer spans, semantic subject, negation, qualifiers, stated audience/task and explicit reason-to-choose language. Normalize equivalent phrasing against a versioned taxonomy. Keep raw wording inspectable. Do not equate generic “easy to use” with a specific waste-control capability or elevate material calculation into professional estimating.

LLM assistance may propose extraction/mappings but must return evidence spans. Validate spans and semantic boundaries against stored answers; preserve ambiguous cases as unresolved or route to review. Treat website/search content as untrusted; source instructions cannot change the rubric, reveal private data or trigger actions.

New candidate associations outside the frozen inventory can appear in an “additional observed associations” detail and be considered for the next version; never silently change denominators or previous results. Missingness is evaluated only for relevant supported associations in the declared completed question set.

## 4. Evaluate expression and alignment separately

Resolve `present` for explicit mention; `emphasized` only when exact text gives a feature as a reason to choose or connects it to user value. A repeated phrase or favorable adjective alone does not pass emphasis. Correct explicit exclusions are retained as useful scope recognition. Negated claims cannot count as positive feature associations.

Compare each expression with supported capability scope: accurate/qualified, misleading or unresolved. Distinguish direct contradiction from insufficient evidence. A supported association missing in completed answers is an opportunity; an unsupported claim repeated confidently is a representation risk. Unknown source evidence remains unknown. Failed/partial provider runs are coverage-limited, not evidence the model lacks the association.

Source strength is shared, not recalculated as model opinion. Actual disclosed citations are model-specific; do not claim to know all influences or infer a source caused the association. Assess new cited sources or label them unassessed. Keep native citation provenance, exact source passage support and source snapshots under existing access/retention controls.

## 5. Verify competitive distinctions independently

Before calling a feature a competitive advantage, define a small named comparison set and comparable tool/task scope. Record dated official/source evidence or authorized functionality observations for the same relevant feature/workflow and actual limitations. Do not compare an individual concrete calculator with an entire estimating suite as though feature counts establish superiority.

Store what each model claims distinguishes the site separately from what the comparison evidence supports. Shared features remain useful benefits, not exclusive advantages. No comparator evidence yields “not established,” as in the fixture. Lack of evidence for a competitor feature is not proof the competitor lacks it. This implementation does not require subscriptions/purchases, outreach or modifying third-party sites without separate authorization.

## 6. Render useful owner conclusions

Show the four model descriptions together, the baseline/association matrix, relevance and reason-to-choose findings, competitive-evidence limits and model-specific history. Expand to exact answer, question, model/configuration/date, citation and baseline passage. Avoid inventing an overall identity score. If frequency is later shown, count answer/opportunity occurrences with explicit n rather than words and preserve independent trials.

Rank factual improvements by supported user relevance and severity of misrepresentation. Suggest clear scope, explanations of useful controls/assumptions and verified differences. Never recommend invented claims, fabricated reviews or simply forcing a keyword into every answer. A model error despite adequate public content is not automatically an owner website defect.

## 7. Preserve history and separate verification triggers

Persist immutable baseline/taxonomy/question/model/settings/source versions, trials, extraction/rule versions, states and exact answer/citation artifacts. Compare compatible observations by provider/association ID. Show association gained/lost, feature newly tied to value, overclaim corrected/persistent and changed citations. Model, test-mode, scope, prompt-set or sampling changes create a disclosed boundary.

Source changes have their own verification. Representation changes need actual new model responses. Cached responses keep original timestamps; retries are not independent samples. First run has no invented previous result. No causal identity-shift claim from one changed answer or newly cited page.

Use durable stages and idempotent provider/question/trial keys, bounded page/token/call/retry budgets and existing entitlement/cost controls. Resume without duplicate charges; render completed models while exposing failures. A source-only refresh does not fabricate fresh model history; a prompt-only refresh does not silently recrawl every source or comparator. Real customer evidence stays private; only synthetic examples/specifications enter GitHub.

## 8. Acceptance cases

- All four providers visible; five association rows and five declared questions preserved separately.
- Correct recognition of nonexistent full-estimating functionality is an exclusion, not a missing strength.
- Negated waste control or unsupported “guaranteed savings” cannot become a supported positive association.
- Visible formulas do not establish verified accuracy; DIY fit does not imply professional engineering approval.
- Present versus emphasized requires inspected text, not word counts or invented statistics.
- Failed/incomplete test cannot become not-mentioned without coverage qualification.
- Ambiguous feature scope and baseline uncertainty remain unresolved/qualified.
- Generic ease-of-use language does not map to specific capabilities; synonyms preserve meaning without changing scope.
- Competitor difference requires named comparable evidence; unknown competitors cannot justify uniqueness or superiority.
- Citation is an observed disclosure, not causal influence; new sources require assessment.
- Previous/current history matches stored row states; first-run/model changes/cached samples stay explicit.
- Synthetic fixtures show zero live calls and no invented raw responses/timestamps; production rejects missing evidence.
- White background, all-black text, keyboard-operable details, mobile table scrolling and inspectable sources are retained.

This documentation/visual update does not implement an audit service or run real calculator/model tests.
