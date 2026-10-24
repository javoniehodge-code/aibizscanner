# Distinctive & relevant — data contract v1.0

Use the [shared multi-model contract](../../multi-model-data-contract.md) for provider identity, raw answers, tools, provenance, failures, sampling and history.

## Baseline and scope

Store business/product/tool identity, language/market, source snapshots/hash/time, industry/category and declared supported capabilities, limitations and relevant audiences with exact evidence. Owner-provided facts are labeled separately. Desired positioning is not a required input and cannot become the truth key.

An association record has stable ID, display label, synonyms/normalization version, semantic scope, business relevance/reason, baseline support (`supported`, `mixed`, `not_supported`, `unresolved`) and exact evidence IDs/qualifiers. Track candidate associations independently of outcomes; adding a newly discovered association versions the scope rather than retroactively changing earlier scores. Never assume unsupported means disproven; record whether a direct contradiction or merely insufficient evidence exists.

## Observations and states

For each provider/association/run store response/question/trial IDs, exact answer spans and locations, semantic extraction/mapping version, negation/qualifiers, model-supplied reasons, actual disclosed citations and comparison against the baseline. All production provider metadata and raw response artifacts are required.

Keep two dimensions: `expression` (`emphasized`, `present`, `not_mentioned`, `explicitly_excluded`, `unknown`) and `alignment` (`supported`, `qualified`, `misleading`, `unresolved`, `not_evaluated`). Separately preserve provider test completion/coverage. A feature can be mentioned but misrepresented; a capability can be explicitly ruled out correctly. Mixed/unknown source evidence must remain qualified, not transformed into a definitive claim.

Display aliases in the fixture: `present`, `emphasized`, `not_mentioned`, `bounded` (correctly distinguishes an unsupported broader capability) and `misleading`. Production rendering derives labels from both dimensions and evidence. Baseline-supported missing features can become opportunities; not mentioning an irrelevant feature is not a gap.

`emphasized` requires exact text using a feature as a reason to choose or explicitly connecting it to user value. Mere repetition, first position, adjective intensity or a high token count is insufficient. `not_mentioned` requires completion of the full declared question set (or an explicit partial-sample label); failed/unavailable tests yield unknown/coverage-limited instead.

Association normalization may combine equivalent meaning but must preserve material distinctions: concrete calculation versus full estimating; optional waste controls versus guaranteed waste reduction; visible formulas versus verified accuracy; DIY planning versus approved engineering design. Negated statements cannot be counted as positive associations.

## Frequency, competitive distinction and counting

Report association/question/trial/provider counts separately. This fixture has 5 questions × 4 providers with one declared synthetic answer each, and 5 tracked association rows. There were zero actual model calls. No frequency percentages or overall score are computed.

If frequency is added, define explicit qualifying question opportunities, independent trials and count rule. Count once per answer/opportunity, not word occurrence; show n and denominators, prompt-set changes and sampling uncertainty. Diagnostic answers do not establish organic recommendation frequency.

A competitive record requires named comparator entities/versions, equivalent task and declared feature/workflow comparison, observed/source evidence with dates, scope and limitations. Store model-expressed distinction separately from our verification of that distinction. State `not_established` when no comparable evidence exists. Useful features alone cannot establish superiority or exclusivity.

## History and improvements

Persist previous/current provider expression, alignment, exact answers/citations and compatible scope/question/model/settings/standard versions. Track gains, losses, same-feature stronger relevance, corrected overclaims and unchanged errors. Preserve unsupported associations that disappear separately from supported associations gained. First run, changed model/scope, failed test and unavailable prior evidence are explicit.

Fixes link association IDs, affected providers, baseline evidence and exact source/content action. Fixing copy is not proof of corrected model output. Rerun the corresponding questions to observe representation; separately verify any source update. No attribution of causal or durable identity shift from a single response change.

The fixture deliberately leaves raw responses, exact spans, model IDs, dates and citations empty. It is valid only with `isIllustrative=true` and the example banner; production scoring and trend pipelines reject it. Current and previous observations are both synthetic.
