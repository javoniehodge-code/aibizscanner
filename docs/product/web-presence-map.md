# Web Presence Map

Version 1.0 • 10 November 2026
Status: agreed product structure for the full diagnostic report; not implemented functionality.

## Purpose

Show what third-party websites say about a business, where useful information is missing or conflicting, and what the owner can improve.

The map belongs within **Your Presence Across the Web** in the full diagnostic. It draws on citations from AI Prompt Analysis and additional pages found through research. It is a report section, not a separate product.

The business's own website is assessed under **Your Website**. Use its sourced facts and owner-confirmed corrections as comparison baselines, preserving their provenance and uncertainty.

## 1. Main layout

Use one grid:
- **Rows:** websites.
- **Columns:** the six information categories below.
- **Cells:** a concise status. Clicking a cell reveals what the checked pages say, supporting evidence, any issue and a suggested action when warranted.

Keep the first view compact. Detailed findings, pages and methodology belong in expandable evidence rather than permanent extra columns.

| Column | What it covers |
| --- | --- |
| Business details | Business identity, contact information, opening hours and relevant credentials |
| Services & offerings | Actual products, services, amenities and features |
| Customer fit | Needs, occasions and customer suitability explicitly described by the source |
| Reviews | Customer ratings, review evidence and relevant feedback themes |
| Recommendations | Editorial endorsements, comparisons and ranked lists; preserve the reason and any conditions |
| Locations & coverage | Physical locations, neighborhoods and service areas |

Customer fit records what sources actually say. It does not infer a demographic audience from imagery or create an invented customer profile.

Recommendations include unranked endorsements. Do not require a numerical ranking. Distinguish editorial recommendations, customer reviews, paid placements and business-submitted descriptions when their origin is identifiable.

## 2. Website labels and filters

Beside each website name, show:
- Website/domain and source type.
- **Cited in AI answers** or **Additional source**.
- For cited websites, expandable provider names, citation counts and exact prompt/answer references.
- Number of pages checked and unresolved retrievals.

A website is labeled cited only when at least one exact page has a recorded citation. Other pages found on that domain retain their own additional-research provenance. Do not imply that every checked page on a cited website was cited by AI.

Default to cited websites, ordered by the number of distinct usable answers citing the website. Provide **Cited sources / Additional sources / All checked sources** filters. Use a stable tie-break for equal counts. Additional-source ordering can follow disclosed research priority; it must not invent citation frequency.

Allow citation filtering by **All four AIs / ChatGPT / Claude / Gemini / Perplexity**, defaulting to All four AIs. Source content is assessed once per checked page, not given four invented model-specific quality scores. Provider selection changes the cited-source scope and citation evidence, not the underlying page facts.

When multiple providers or repeated samples cite a website, label answer counts as answer counts. Deduplicate each website once per answer. Do not present these as distinct-question counts without a separate question-level calculation.

## 3. Cell statuses

| Status | Meaning |
| --- | --- |
| Present | Relevant information was found and meets the applicable source-purpose standard |
| Limited | Some relevant information is present, but important applicable detail is missing |
| Conflict | Information disagrees with a traceable factual baseline or another checked page |
| Not found | Relevant information was absent from the successfully checked pages |
| Couldn't check | Access or evidence was insufficient to assess the category |
| Not applicable | The category is not reasonably expected for this source's purpose |

Use the same wording throughout the map. Keep a short legend available.

### Assessment rules

- Judge information against both the business type and the source's purpose. A newspaper article does not need to list opening hours; a business profile reasonably may.
- Do not penalize a source for omitting information it is not intended to provide.
- “Present” means relevant coverage, not favorable sentiment, factual verification or endorsement.
- A negative review is still review evidence. Record the concern and its supporting context in the expanded cell.
- “Not found” applies only to the pages actually checked. It is not a claim that the entire website omits the information or the business.
- “Couldn't check” is never converted into missing information.
- Compare facts with a sourced, dated baseline. Owner-confirmed information is a comparison reference, not automatic independent proof.
- A clear recorded conflict remains visible even if another page could not be checked. Disclose the incomplete coverage alongside it.
- Where unassessed pages prevent a meaningful domain-level conclusion, show “Couldn't check” or a visible partial-assessment qualification rather than a misleading complete result.
- Do not apply a universal mention-quality score or treat simple presence as proof of credibility.

Source-purpose standards and the material detail required for “Present” versus “Limited” must be documented and versioned by business/source type before production assessment. Do not let arbitrary wording differences create a missing-information finding.

## 4. Expanded cell

Use the following sequence:

1. **What it says:** a short plain-language summary, including the nature of the mention.
2. **Evidence:** exact excerpt, page title and clickable URL; show page-check date and citation/research provenance.
3. **Any issue:** missing detail, factual disagreement, explicit concern or conflicting checked pages, with the comparison baseline where relevant.
4. **Suggested action:** a specific correction or improvement when supported; otherwise no action is needed.

Keep page-level detail expandable. Include the relevant provider/prompt/answer references when a page was cited.

Example — fictional hotel / Services & offerings:
- Status: **Limited**.
- What it says: “Boutique hotel near the historic district.”
- Evidence: exact checked article excerpt and URL.
- Issue: the article does not describe the family suites or connecting rooms documented on the hotel's website, although its hotel-comparison purpose makes these relevant.
- Suggested action: provide the editor with factual details for consideration. The publisher decides whether to update the article.

Example — hotel listing / Business details or Locations & coverage:
- If a material fact is disputed, show **Conflict** and the observed value, baseline value and sources.
- Do not silently rewrite the listing with owner-supplied information.
- Avoid duplicating the same issue as separate action items just because it affects more than one cell.

## 5. Several pages on one website

A row summarizes checked pages from the website. It must never hide disagreement or imply a complete crawl.

For each cell:
- Preserve which pages support the finding.
- Retain excerpts and observations per page.
- Disclose relevant checked-page counts, inaccessible pages and limitations.
- Show conflicting page statements together rather than merging them into “Present.”
- Keep canonical URLs and deduplicate repeated/reused evidence.
- Preserve branch/location identity; a correct fact about one branch must not overwrite another.

A website may include an article, a review profile and a directory listing. Record each page's role independently rather than assuming the domain has only one purpose. Use page-specific applicability when aggregating the row.

## 6. Discovering additional pages

Start with the exact pages cited in AI Prompt Analysis. Then broaden discovery through a separately recorded process:

1. Search the business name, aliases, domain and relevant locations for existing profiles, articles, reviews and listings.
2. Search important offerings, industry topics and peer businesses for relevant sources and possible coverage gaps.
3. Prioritize candidates using business relevance, observed citation use, peer coverage, source role and potential to resolve a factual question.
4. Confirm business identity, select exact pages, remove duplicates and record why each was selected.
5. Retrieve and inspect the pages; save supporting passages, timestamps and failed-access states.
6. Assess them using the same grid standards, retaining the **Additional source** label.

Do not assume LinkedIn, YouTube or another platform is useful for every industry. An additional opportunity needs a stated relevance basis. A search-result snippet alone does not establish complete page contents or source-wide absence.

Disclose the selected page inventory and checking limits. Search/query budgets, page caps and exact integrations remain implementation choices; no unlimited whole-web review is promised.

Keep citation observations and independent research separate:
- A cited page has a recorded connection to an AI answer.
- An additional page can be useful to investigate without any observed AI citation.
- Being uncited in the tested answers does not prove that no AI ever uses it.
- Citation frequency does not establish causal influence or return on investment.

## 7. Connections to the rest of the diagnostic

| Related section | How the map connects |
| --- | --- |
| AI Prompt Analysis | Reuse original citations, provider identities, questions and answers; open the answer behind a cited source |
| Your Website / Clear & Complete | Compare outside descriptions with sourced information about actual offerings and important facts |
| Consistent & Current | Reuse factual discrepancies and comparison evidence; do not generate competing versions of the same finding |
| Credible & Corroborated | Reuse review evidence, independent recommendations and outside support; quality of a mention remains separate from source reputation |
| Peer / company-by-website comparison | Compare coverage using compatible page scope and evidence; the main map remains focused on what sources say about the target |
| Action Checklist | Create stable, evidence-linked tasks with suggested responsibility and a verification method |

The map complements the existing [Credible & Corroborated section](ai-brand-perception/sections/credible-corroborated/README.md). It is a broader cross-source information grid, not a silent replacement of that section's review/support analysis.

Use the existing [AI Prompt Analysis schema](visibility-report-schema.md) and [checklist rules](brand-evidence-and-checklist.md) for shared observations and task verification. A source correction and a corrected future AI answer remain separate verification events.

## 8. Minimum logical data fields

This is a logical contract, not a database migration.

| Record | Required information |
| --- | --- |
| Website row | Domain/website ID, name, source roles, cited/additional provenance, checked-page inventory, retrieval completeness |
| Page evidence | Page ID, exact/canonical URL, title, page role, business/branch identity, retrieval date/status, extracted passages |
| Citation link | Page ID, original answer/prompt/run ID, provider/model, citation annotation and timestamp |
| Category assessment | Website ID, category, status, summary, applicability basis, supporting page/excerpt IDs, baseline references, rule version, limitations |
| Finding/action link | Stable finding ID, affected cells, issue, proposed action, suggested responsible role, verification and task link |

Preserve old snapshots and page-check history so a future report can distinguish changed source content, changed assessment rules and changed AI citations.

## 9. Presentation and acceptance

- Title: **Web Presence Map**.
- White background and black text throughout, including supporting text and status labels. No gray text or color-only meaning.
- One website per row and the six agreed information columns.
- Concise cell labels; click/tap opens the evidence and any supported next step.
- Cited/additional source distinctions remain visible at website and exact-page level.
- Cited sources appear first by default; additional and combined views remain available.
- Four-provider citation filters use actual observed citation links.
- Source-purpose applicability prevents irrelevant missing-information findings.
- Page-level disagreements and retrieval failures remain visible.
- All findings are scoped to checked pages and linked to evidence.
- Mobile access, keyboard navigation and readable labels are required.
- Illustrative content is labeled invented; this document creates no live findings or implementation.
