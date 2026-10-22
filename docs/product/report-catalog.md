# Report catalog
Version 0.2 • 22 October 2026

## Shared contract
All four reports are available at launch and purchasable individually, without a subscription. Free access is a limited visibility sample. Agency packs are later; subscription design is TBD.

Coverage: direct OpenAI, Anthropic, Google Gemini and Perplexity APIs. Record actual model/search configuration; consumer product names describe coverage, not exact app replication. No Google AI Overviews in the MVP.

Each checkout discloses its report type, questions/task kinds, provider coverage, repetitions, competitors/locations, language, price, retention and incomplete-result policy. These numerical caps/prices are open decisions and must be configured before charging.

Every report includes executive summary, question/provider evidence table, original answers and citations, timestamps/settings, successful versus missing task counts, and PDF/verified email access. Clearly label seeded examples. Customer inputs are reviewed and frozen before purchase.

## 1. AI visibility report
**Question:** Where does my business appear, who else appears and what sources are cited?

Inputs: business name/domain, confirmed profile, optional market, optional selected competitors, language and approved unbranded customer questions.
Outputs:
- Mentions and recommendations per question/provider with underlying counts.
- Competitor appearances and gaps in the same answers.
- Business-domain citations and most frequently cited websites/pages across all sources, with counts and links.
- Original evidence and a concise action/opportunity checklist with any advice labeled.

A competitor gap means a successful sampled answer recommends the competitor but does not recommend the target. Mention-only gaps may also be shown under a separate label. Failed/ambiguous responses do not establish a gap.
Use the same captured answers to compare businesses; do not insert competitors into unbranded questions.

## 2. Brand perception report
**Question:** How does AI describe the company, which needs does it associate with the company and what could the owner improve or explore?

Inputs: disambiguated business identity, optional comparison brands, approved named-brand questions covering descriptions, strengths, concerns and suitable/unsuitable customer situations.
Outputs:
- Quoted brand descriptions and stated strengths/concerns by provider, with supplied citations.
- Situations AI says the business suits or does not suit, explicitly labeled **named-brand feedback**.
- **Tested findings:** any separately executed unbranded discovery tests, with their own evidence and totals.
- **Other ways customers could discover you:** creative customer situations and candidate questions.
- **Suggested improvements:** evidence-linked actions and clearly identified assumptions/owner confirmations.

Do not require proof of search demand before suggesting creative opportunities. Do not assert the business already provides an unverified service.
A named-brand suitability answer does not count as natural discovery. Generated ideas do not become tested findings until explicitly selected, executed and stored as new tests.
“Relevant to my business / Opportunity to develop / Not relevant” is a proposed self-service interaction, not a requirement for human review.
Do not claim AI knows why another provider omitted the business; retain any reasons as stated explanations, not causal proof.

## 3. Competitor analysis report
**Question:** Which tested prompts recommend selected competitors, which do not and where are the gaps?

Inputs: business/category context, selected competitors and optional target business, market, language and approved unbranded questions. Competitor-only analysis without a target is a proposed capability, not a confirmed commercial requirement; settle before exposing it.
Outputs:
- Question × business comparison with provider/run detail.
- Prompts where each competitor was recommended versus not recommended in successful answers.
- Shared opportunities, competitor-only appearances and target-only appearances when a target exists.
- Citation/source comparison, with exact evidence.
- Generated follow-up opportunities clearly separate from tested results.

The visibility report contains a basic competitor comparison. This report centers deeper competitor coverage and prompt-level gaps; breadth/caps must be disclosed rather than invented.
Explicit “compare these brands” tasks, if offered, are labeled separately and excluded from unbranded discovery totals.
Do not call a business “never recommended” based on absence in this sample.

## 4. Location comparison report
**Question:** How do sampled results differ across selected markets?

Inputs: business identity/profile, at least two explicit comparison locations, language and an approved common question family with location-specific wording.
Outputs:
- Side-by-side question/provider/location mentions, recommendations and citations.
- Selected competitor appearances and gaps by location.
- Exact location wording and any supported provider geographic setting.
- Counts and missing coverage for each location; original answers for every cell.

Keep intent, model/search settings, repetitions and question structure consistent except for declared location differences. Explain service-area/branch identity matching.
A named place in a prompt is not physical search location. No precise neighborhood ranking heatmap inferred from wording-only tests.

## Task and evidence rules
| Kind | Purpose | Counts toward unbranded discovery? |
| --- | --- | --- |
| Unbranded discovery | Test a neutral customer need | Yes |
| Named-brand analysis | Ask about the identified company | No |
| Explicit brand comparison | Compare supplied brands | No |
| Opportunity generation | Suggest situations/prompts | No |
| Advice synthesis | Explain observed evidence and possible actions | No |

Distinguish a mention from an actual recommendation. A negative reference is not a recommendation. Record ambiguous identity/recommendation classifications and show their evidence.
Informational/DIY answers can cite sources without recommending businesses. Show “No business recommendation returned” rather than implying a competitive loss.

For top-source frequency, count a page/domain at most once per successful answer for its respective frequency table; preserve every original citation in evidence. Separate page counts from domain counts and display denominators.

No unseen source-content claims: a citation URL alone does not prove what the page says. Fetch through the protected path before describing page contents; otherwise show only available citation metadata.

## Reuse, freshness and costs
Share compatible evidence within a purchased scan/report family when its exact configuration, dates and access permissions match. Disclose reuse and collection time. Never count one answer as independent repetitions, silently substitute old free results for fresh paid runs or expose unpaid report types.
Task costs depend on questions × providers × repetitions × locations, plus named-brand, suggestion, analysis and retry work. Report size and task budget must be computed from the actual frozen configuration, not the old 48-answer assumption.
