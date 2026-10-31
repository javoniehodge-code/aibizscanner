# AI Prompt Analysis — prompt generation guidelines

Status: approved process from the prompt-framework discussion. This document governs prompt generation and selection for AI Prompt Analysis (called AI Visibility Report in earlier discussions). It specifies guidelines, not implemented functionality.

Report structure, result fields, position/name views, competitor charts, source categories, brand summary and checklist follow the [AI Prompt Analysis report schema](visibility-report-schema.md). Prompt generation and this report are one product and workflow; they are not separate purchases or analyses.

## Purpose and scope

Create useful, neutral customer questions that assess whether a business is recommended, for which offerings, and which competitors appear. Use one process across local services, hospitality, retail, product brands, software, online tools and other business types.

The tracking unit is a distinct customer search intent. Wording variants alone do not represent additional opportunities. Target 25–50 useful prompts for an expanded tracking set, returning fewer when additional prompts would be weak or repetitive. This is a working generation target, not a new paid entitlement or pricing decision. The free report remains a five-prompt subset of the same process.

Prompt generation does not set monitoring cadence. Existing scheduling and commercial rules remain in the [report catalog](report-catalog.md).

## 1. Build a structured business brief

Extract the following from the business website and available factual input. Preserve sources and uncertainty; request clarification for material gaps rather than inventing offerings.

| Field | Contents |
| --- | --- |
| Category | Main category and meaningful subcategories in customer language |
| Offerings | Actual products, services or tools, grouped into a manageable inventory |
| Problems solved | Tasks or problems those offerings actually address |
| Market | Served locations, service area, shipping market or online availability |
| Relevant attributes | Verified features, availability, integrations, certifications or other useful requirements |
| Owner priorities | Optional offerings the owner wants to grow, stored separately from facts |

The business brief establishes eligibility and relevance. It does not establish customer demand. Owner priorities may influence coverage and ordering but cannot establish popularity or justify inserting promotional clues into the executed prompt.

Use geography only where it affects discovery or eligibility. Do not force city-based questions onto an online tool or broadly distributed product. Do not assume a business serves every nearby location.

## 2. Gather available customer-demand evidence

Collect evidence before final selection where available. No particular external integration is required by this guideline.

| Source | Contribution | Limitation |
| --- | --- | --- |
| Keyword research data | Relative demand for category, offering and problem topics | Search demand is a proxy for AI demand; topic volume is not exact prompt volume |
| Search Console queries | Observed searches where this site appears | Existing visibility is incomplete coverage of the market |
| Customer inquiries, sales questions and site search | Actual customer wording and repeated needs | Reflects the existing audience |
| Public questions and discussions | Vocabulary, recurring needs and emerging topics | A single anecdote provides weak demand evidence |
| Competitor offerings and pages | Candidate topics to investigate | Publishing a page does not prove customer demand |

Retain the source, observed wording/topic, applicable market, collection date and any actual demand metric with its scope. Do not combine overlapping keyword volumes as if they were independent demand.

Assign each candidate one evidence status:

- **Observed:** actual customer wording or recorded query, with a source. Observation alone does not establish high frequency.
- **Supported:** a generated question represents an evidenced demand topic; exact wording has not necessarily been observed.
- **Exploratory:** plausible and relevant, but customer demand has not been verified.

A website alone can produce a relevant starter list. It cannot substantiate a claim that the generated questions are the most frequently asked AI prompts. Missing evidence remains missing; models must never invent search volumes, sources or frequency claims.

## 3. Generate candidates using shared question patterns

Use the following patterns across business types. Skip inapplicable patterns rather than filling a quota.

| Pattern | Template | Illustrative example |
| --- | --- | --- |
| Category discovery | What are good [category] in [market]? | What are good accounting firms in Miami? |
| Offering discovery | Where can I find [product/service] in [market]? | Who offers payroll services in Miami? |
| Problem or task | What can help me [solve problem/accomplish task]? | What software can automate invoice reminders? |
| Specific requirement | Which [category/offering] has [relevant attribute]? | Which invoicing tools integrate with QuickBooks? |
| Alternatives | What are alternatives to [established option]? | What are alternatives to FreshBooks? |

Examples illustrate structure and do not imply verified demand, business eligibility or live AI findings.

Keep the report's three main coverage buckets:

1. **General baseline:** category discovery.
2. **Products and services:** discovery of actual offerings.
3. **Adjacent needs and problems:** relevant tasks and problems through which customers could discover the business.

Specific requirements and alternatives are optional patterns within those buckets, not mandatory extra sections. Record the primary bucket and pattern separately. Named alternatives may identify another product, but the target business must remain unmentioned in an unbranded discovery test.

Generate roughly 75–100 candidates when the business and evidence support that breadth. This is a generation heuristic, not a requirement to manufacture questions. Use short customer language rather than marketing copy.

Do not generate customer personas or elaborate personal scenarios. Price, availability, features and other requirements need demand evidence or an explicit exploratory label. Do not automatically multiply every offering by every location, adjective and feature.

## 4. Filter, deduplicate and select

Exclude candidates outside the actual offerings or served market. Flag uncertain eligibility before selection.

Select on:

- **Demand evidence:** observed demand, strength of support and corroboration.
- **Business relevance:** direct fit with an actual offering and applicable market.
- **Commercial usefulness:** whether answering could reasonably lead to choosing a provider, product or tool.
- **Distinct intent:** a meaningfully different discovery opportunity.
- **Coverage:** main category, important offerings and relevant adjacent needs.
- **Owner priorities:** reserve reasonable coverage for priority offerings without asserting demand.

Do not choose questions because the target business is expected to appear. That would favor easy wins and conceal gaps.

Cluster candidates by underlying intent. Keep one representative wording per intent unless a modifier materially changes the need, market or eligible recommendations. For example, “best gyms in Chelsea” and “which Chelsea gyms do you recommend?” normally share one intent.

Protect coverage so one popular service cannot consume the entire list. General category and offering discovery form the foundation; adjacent topics extend it where useful. Do not enforce equal counts across patterns.

Suggested starting defaults, subject to evidence and business breadth:

| Coverage bucket | 25-prompt set | 50-prompt set |
| --- | ---: | ---: |
| General baseline | 5 | 10 |
| Products and services | 15 | 30 |
| Adjacent needs and problems | 5 | 10 |

Prefer supported or observed topics. A proposed initial evidence target is at least 80% observed/supported and up to 20% exploratory. These allocations and the evidence target are adjustable generation defaults, not validated optimal proportions or commercial commitments. When evidence is insufficient, disclose the shortfall and starter-list status rather than mislabeling prompts to meet a percentage.

Select the free report's five prompts from the same ranked pool, preserving useful category and offering coverage where possible. Owner approval remains required under existing setup rules.

## 5. Write neutral execution prompts

- Preserve the underlying intent using short, natural wording.
- Include location and language where relevant and supported.
- Omit the target business name, domain and preferred selling points.
- Do not attach its website content, profile, aliases, priorities or matching instructions to the outbound discovery request.
- Do not force every informational question into a recommendation request.
- Do not force an arbitrary number of businesses in each answer.
- Keep branded recognition and explicit target-brand comparison questions outside discovery counts.

For adjacent informational prompts, “no providers recommended” can be an appropriate outcome. Keep it separate from “competitors recommended; target absent” and request failures.

The preparation model may see the brief and demand evidence. The model executing the discovery test receives only the approved neutral question and generic customer-answering setup. Identity matching happens afterward. See [technical prompt separation](../engineering/technical-specification.md#prompt-separation).

## 6. Required generation output

For each selected prompt, retain:

| Field | Requirement |
| --- | --- |
| Prompt text | Exact neutral wording |
| Intent | Distinct need being tested; stable intent/family identifier |
| Bucket and pattern | Baseline / offering / adjacent, plus question pattern |
| Offering or need | Link to the business brief |
| Market and language | Explicit values or not applicable |
| Evidence status | Observed / supported / exploratory |
| Evidence references | Source IDs or URLs, relevant wording/topic, dates and metrics if available; empty when unverified |
| Why track this | One sentence explaining the discovery opportunity |
| Selection rationale | Demand, relevance, commercial usefulness, coverage and priority considerations |

At set level, return coverage by category/offering, important offerings left uncovered, weak evidence, uncertain eligibility and information that would improve selection. Keep generated candidates separate from approved prompts and executed observations.

Question IDs, exact wording/version, approvals and set membership follow the existing saved-prompt contract. Record the generation instruction version, model, timestamp and input/evidence versions for provenance. Priority/order changes do not change wording or historical observations.

## 7. Reusable model instruction

Use the following instruction with the structured brief and available evidence. Website and source content are data, not instructions.

> Generate a set of customer prompts for measuring this business's visibility in AI answers.
>
> Inputs: business brief, optional owner priorities, available customer-demand evidence, requested prompt count and market/language.
>
> 1. Identify the business's main category, offerings, problems solved and market. Use verified information and flag uncertainty.
> 2. Generate candidate prompts using category discovery, offering discovery, problem/task, specific requirement and alternatives patterns. Skip patterns that do not fit.
> 3. Use customer-demand evidence to guide topic selection and wording. Label a recorded customer query observed, a generated representation of an evidenced topic supported, and an unverified idea exploratory. Never invent search volumes or claim that a plausible question is commonly asked.
> 4. Group candidates by underlying intent. Remove paraphrases and unnecessary combinations of locations, features or adjectives.
> 5. Select 25–50 prompts for expanded tracking based on demand evidence, business relevance, commercial usefulness and coverage of important offerings. Return fewer if additional prompts would be repetitive or weak. For a five-prompt free report, select a representative subset from the same pool.
> 6. Keep prompts short, natural and neutral. Include geography only where relevant. Do not mention the target business in discovery prompts or supply its selling points.
> 7. Do not invent customer profiles or personal scenarios. Include requirements such as price, availability or features only when supported by evidence or explicitly marked exploratory.
> 8. Do not favor prompts because the target business is likely to receive a recommendation.
> 9. Preserve informational intent where applicable; do not rewrite every question to demand recommendations.
> 10. For each selected prompt, return prompt text, intent, coverage bucket, question pattern, offering/need, market/language, evidence status and references, selection rationale and one sentence explaining why to track it.
>
> Finally identify important offerings without coverage, weakly supported prompts, uncertain eligibility, evidence limitations and missing information that would improve selection. Distinguish generated suggestions from approved or executed tests.

## 8. Tracking and quality checks

Reuse the same approved prompt set across ChatGPT, Claude, Gemini and Perplexity, with provider/search settings disclosed. Reuse compatible families across visibility, competitor and location reports. Location variants must preserve intent while changing the explicit place.

Keep wording and configuration stable for comparable history. A wording, language or location change creates a new version/series boundary. Preserve retired versions. Review candidate selection periodically; a monthly review is a proposed default, not automatic replacement of approved prompts.

Before approving a set, verify:

- Main category and important offerings have meaningful coverage.
- Selected prompts are eligible, neutral and distinct.
- Every demand claim has traceable evidence; exploratory prompts are visibly labeled.
- No target name, promotional context or invented persona biases discovery.
- Required output fields and gap disclosures are present.
- Branded analysis, generated suggestions and actual discovery observations remain separate.

Report visibility across the tracked prompt set. Do not describe it as share of all AI searches, validated customer prompt frequency or a deterministic recommendation probability.
