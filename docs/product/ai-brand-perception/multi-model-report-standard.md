# Model comparison is required in every report section

Confirmed product direction: 24 October 2026. Customers pay to understand how their business appears to **ChatGPT, Claude, Gemini and Perplexity**, and how that changes over time. A shared evidence assessment alone does not fulfill that requirement.

## Two layers, always visible

1. **Shared baseline:** Assess source facts and strength once against versioned industry standards. Do not let four model opinions redefine what is true or supported.
2. **Four observed model results:** Put all four named columns side by side in every section, with actual answers, evidence and disclosed citations. Show how each differs from the baseline and from its own prior run. Tabs may navigate report sections, but must not hide provider comparison behind a single-provider view.

Each section needs a model-specific verdict, counts with explicit units and denominators, a comparison table, expandable exact answers/source evidence and a per-model change summary. Show unavailable, not tested, not addressed, unsupported and conflicting as distinct outcomes. Do not collapse them into a generic failure or hide them from the denominator.

## Meaning of the four sections

| Section | Shared baseline | Per-model observation | Meaningful change |
| --- | --- | --- | --- |
| 1. Discovery & accessibility | Selected page inventory and site access evidence | Published permissions, observed search discovery and observed URL-reading separately for each provider | Which selected pages/access outcomes changed for that provider |
| 2. Clear & complete | Clear, concise, complete website detail for 5–10 decision facts | How well each model answers the same diagnostic questions using the same supplied website passages | Specific facts newly answered with support, partial answers, unsupported claims and unresolved gaps |
| 3. Consistent & current | Website baseline plus like-for-like cross-source consistency/currency assessment | What each model says when independently searching for the same named-business facts; disclosed sources and appropriate qualifications | Fact answer changes and citation changes, recorded separately |
| 4. Credible & corroborated | Source strength for quality, suitability and relevant claims | Evidence and caveats reflected in each model's independent web-search answers; source citation matrix | Supported conclusions, lost caveats, overclaims and source changes for each model |

The Section 2 supplied-evidence diagnostic and the Sections 3–4 independent-search observation are **different test modes**. Label them prominently. Section 2 cannot establish organic discovery, and a general provider answer cannot be represented as a grounded reading test without the required provenance. Same query wording does not mean the providers actually retrieved the same sources.

## Coverage and limits

Use ChatGPT, Claude, Gemini and Perplexity as owner-facing provider/product labels, while recording the exact API model/version and tool configuration used. An API run is not proof of identical behavior in the consumer app. State the tested route and date in test details. If a supported browsing/retrieval capability cannot be verified for a route, show the limitation instead of fabricating an answer or silently substituting a different test mode.

The named-business diagnostic questions in these sections are not unbranded buyer recommendations. A correct fact or evidence-aligned conclusion is not a recommendation, a rank or a visibility score. Keep those metrics separately named.

Preserve the approved 5–10 decision-fact standard across Sections 2–3: Core and When relevant only. Reputation questions in Section 4 cover quality, guest fit and relevant claims; they are not additional decision-fact rows in the hotel standard.

## History

Store the baseline and every provider response separately for every run. Show previous/current dates, result counts, answer changes, cited-source changes and unresolved issues per model. Production dates cannot be inferred from synthetic Previous/Current labels. No prior compatible run means “First run,” not zero improvement. Failed refresh means unavailable/last checked, not a current observation.

Only compare the same declared business/entity scope, fact/question set, test mode, language/market, tool configuration, sampling plan, standard/rubric and actual model identity. Surface relevant version or scope changes before drawing trends. Reassess a prior answer against a newly changed baseline explicitly rather than rewriting history. Record a website/source correction separately from whether a model answer changes; neither proves causality.

Start with one answer per question/provider as a disclosed snapshot. Do not treat it as a stable probability or draw smoothed certainty from it. Optional reruns use fresh recorded calls and distinguish independent samples from cached/reused responses. Compare equivalent sampling plans and preserve all observed variation; no cherry-picking the best answer.

## Current revised references

- [Combined preview](model-comparison-preview.html)
- [Section 2](sections/clear-concise-complete/model-comparison.html)
- [Section 3](sections/consistent-current/model-comparison.html)
- [Section 4](sections/credible-corroborated/model-comparison.html)
- [Synthetic aggregate fixture](model-comparison-sample.json)
- [Data contract](multi-model-data-contract.md)
- [Implementation process](../../engineering/multi-model-brand-perception.md)

All comparison answers, citations and earlier results in the references are invented. Model IDs, timestamps, raw responses and evidence are deliberately absent. They cannot pass production scoring validation. Section 2 now illustrates the agreed eight coffee facts, including applicable ingredients/sourcing. This is a **new synthetic fixture**, not a migration of old outcomes or a real discovery about Café Bustelo's products.

## Precedence

This confirmed product direction supersedes older “baseline only,” “no provider columns” and “actual model understanding later” instructions **where they excluded model comparison from a report section**. The evidence baseline remains required. Earlier approved visuals and synthetic fixtures are historical references; the linked four-model designs are revisions implementing the new direction, not a claim that every new synthetic example has separately been approved. Section 1 keeps its established provider comparison and adds the common history/provenance contract. No production scanner is built by this specification change.

## Section 5 model comparison — 24 October 2026
[Distinctive & relevant](sections/distinctive-relevant/README.md) extends the same four-provider layout and compatible-history requirement. Shared baseline: supported capabilities, audiences and limitations. Observations: each model's expressed associations, reasons to choose, caveats/overclaims and disclosed citations. Track association presence, explicit user-value emphasis, missing supported strengths and corrected/persistent mischaracterizations. Independent-search named-site diagnostics remain separate from organic recommendation tests; no baseline feature list is supplied to elicit desired associations. The example has no verified competitive advantage.

