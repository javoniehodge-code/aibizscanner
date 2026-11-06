# Credible & corroborated — data contract v3.0

One audit uses a declared set of relevant recommendation prompts from a referenced AI Prompt Analysis run. Preserve prompt IDs, eligible response coverage, provider IDs, citation events and original response references. Use the [shared evidence and provenance contract](../../multi-model-data-contract.md) for those records.

## Source and review records

- **Cited page:** canonical page ID and URL, title, category, contributing prompt and provider IDs, exact citation references, retrieval state/date and relevant evidence. Keep URLs page-specific; different pages on one domain can have different findings.
- **Business presence:** recommendation with reasons, reviewed by customers, listed or mentioned, not found on the checked page, or could not check. Preserve caveats, the supporting excerpt and any matched competitors explicitly recommended. Do not treat an inaccessible page as absence or a passing mention as endorsement.
- **Support:** plain-language assessment tied to a specific reason to choose the business, source relevance, specificity, independence or disclosures, and evidence. Record duplicates or syndicated origins so they do not imply independent corroboration.
- **Review profile:** exact profile and business match, rating scale/value, total count, recent review count and window, checked date, sample size or coverage where available, representative positive and negative themes, and links to evidence. Mark unavailable data and avoid describing a theme as recurring without sample support.
- **Provenance:** `prompt_analysis_citation` or `checked_separately`. Independently checked profiles never contribute to cited-page ranking. If a profile is both cited and checked, retain both forms of evidence on one record and show it as cited.

## Counting and display

A page counts at most once per distinct eligible prompt, including repeated citations across providers or trials. Denominator is the distinct relevant prompts with eligible completed responses in the declared set. Disclose partial coverage and label unavailable citation metadata; neither is evidence that a source was not used. List the providers that disclosed each page. Counts may overlap across pages and do not measure evidence quality or causal influence.

Store action references to page/profile IDs and evidence. A competitor-only page is a coverage opportunity; a mismatched business fact belongs in Consistent & Current. History is optional and must compare compatible prompt sets and matching source/profile scopes. Do not repurpose evidence-alignment scores as source support or historical coverage metrics.

The sample is synthetic and intentionally omits live URLs, response IDs, retrieval dates and evidence. It cannot be used as a production audit or included in customer trends.
