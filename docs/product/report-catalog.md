# Report catalog
Version 0.3 • 22 October 2026

## Shared foundation
Four individually purchasable reports require an account; no subscription needed for one-off purchases. Timed report bundles are intended; terms remain open. Only AI Prompt Analysis has a free guest version, limited to five approved prompts.
Direct OpenAI, Anthropic, Google Gemini and Perplexity APIs; record actual model/search settings. API responses are not exact replicas of consumer apps. No OpenRouter/Google AI Overviews in MVP.

Product pages and checkout disclose price, coverage, limits, delivery, retention and failure policy. Payment precedes final question approval/setup; purchased scope is frozen first, execution configuration afterward. Validate any post-payment change against purchased scope; never silently charge for extra work.
Reports include executive summary, sources/answer evidence, provider/model/date, successful/missing counts, PDF and optional requested email delivery.

## 1. AI Prompt Analysis
Each AI Prompt Analysis is a one-time report. In one scan session, run each approved prompt 5–10 times on each engine (ChatGPT, Claude, Gemini and Perplexity) using fresh, independent conversations and consistent settings. Fix the target sample count before execution. Show recommendations and appearances separately as counts out of usable answers per prompt and engine, with planned and unavailable counts alongside them. For example, “Recommended in 3 of 10 ChatGPT answers for ‘emergency plumber San Juan.’” Retries fill the original sample slot.

Offer a separate recheck 30–60 days later. Compare the same prompt versions, engines and settings, using the same planned sample counts. Show both dates, counts and percentage-point change. For example, 3/10 → 7/10 is an observed increase of 40 percentage points. Treat it as a change in sampled results and flag partial or incompatible comparisons. Each recheck produces a new snapshot. There is no ongoing monitoring between reports.


**AI Prompt Analysis is the product name. AI Visibility Report is a previous working name for the same product.** Prompt generation, execution and the delivered report are one workflow, not separate products or purchases.

Prompt preparation follows the [AI Prompt Analysis prompt generation guidelines](visibility-prompt-guidelines.md). Report content and logical data fields follow the [AI Prompt Analysis report schema](visibility-report-schema.md). This schema supersedes older visibility layout descriptions where they conflict.

**Question:** Is AI recommending me, for which customer needs, where am I named, and who else appears?

Inputs: name/domain, category, language, relevant market, factual offerings, optional owner offering priorities and approved neutral prompts. Owners do not select competitors for this report; alternatives are identified from the answers. Customer profiles and invented personal scenarios are excluded for now.

Six sections:
1. Executive summary, with per-provider results and explicit denominators.
2. Prompt analysis table with Positions / Business names views: for example, “1st of 5 named” or “Not named · 5 others named.” Preserve mention/recommendation distinctions and original answer evidence.
3. Businesses named: three separate vertical bar charts, stacked Named / Recommended / Explicit first choice, each sorted highest to lowest by its own count. Include the target, provider selection, answer evidence and a supporting position-distribution table. Explicit first choice requires a stated preference; first mention alone does not qualify. [Approved visual](ai-prompt-analysis/businesses-named-preview.html).
4. Categorized source analysis with all four provider columns, top websites per bucket, reference counts, exact pages and supporting answers.
5. Brief brand summary of explicitly stated strengths, concerns and discrepancies across the tested answers.
6. Evidence-linked action checklist, separating source fixes from changed AI representation.

Use black text on white throughout, including supporting text. Distinguish the target using bold text, labels or outlines; the earlier distinct-color suggestion is superseded.

Free: five prompts selected from the same process. Existing guest-flow rules remain unchanged. Expanded generation targets 25–50 useful prompts; this is not a paid entitlement. Repetition count, paid pricing/caps and abuse limits remain open.

Position describes observed answer order, not inferred preference rank. Citation frequency measures observed references, not causal influence. This is the appearances report, not the separately sold full comparative brand assessment. A recommendation gap requires a usable, identity-resolved answer recommending an alternative but not the target.

## 2. Brand Strength Analysis
**Question:** Does AI know the business, how does it describe it, when would it recommend it, and what might improve its prospects?
Ask each AI openly about the named company: known information/sources, suitable prompts/customer situations, unsuitable situations or concerns, stated rationale, improvements and creative discovery ideas.
Do not limit this to a fixed customer discovery test set; generated candidate prompts are a distinct output.
Combine:
1. Each AI's perspective and available sources, compared with owner-confirmed facts and desired positioning.
2. Five documented evidence buckets with green/yellow/red/gray status and detailed findings.
3. Evidence-linked owner checklist and creative opportunities prioritized around business goals.

Buckets: Accessible business information; Independent validation; Customer review evidence; Expertise and supporting evidence; Information currency. See [assessment rules](brand-evidence-and-checklist.md).
No numeric/letter grade or total readiness score. No universal schema/platform/review-count/freshness threshold. Industry-specific applicability matters.
AI's stated suitability is not observed unbranded discovery; quoted rationale is not proof of internal causation.

## 3. Competitive Analysis
**Question:** How does the business compare with up to four selected competitors in AI's assessment, and what can the owner learn?
Inputs: target business, up to four competitors, relevant services/market/language, owner priority categories and approved analysis scope.
Use the same five evidence buckets/rules and comparable collection scope for target and competitors.
Outputs:
- Side-by-side statuses with sources, coverage and limitations.
- What each business does well or poorly under those criteria.
- Each AI's stated comparative preferences for particular needs, with excerpts/sources.
- Differences in reviews, independent mentions, accessible facts, expertise and current information.
- Practical learning opportunities and discrepancy tasks.

This goes beyond visibility's “who appears where.” Reuse compatible visibility evidence with dates; label new named-brand comparisons separately. Do not claim hidden reasons or treat competitor priorities as the owner's priorities.
Competitor-only analysis without a target remains unconfirmed. Competitor facts are observed evidence, not owner-approved truth.

## 4. Location Analysis

Detailed structure and evidence rules: [Location Analysis Report schema](location-report-schema.md), including portfolio scorecard, location/prompt heatmap, HQ versus branch fixes, accuracy errors, internal branch comparison, local competitors, and coverage gaps. The owner website is the factual baseline; source disagreements remain visible. The detailed schema supersedes this older summary where they conflict.
**Question:** How does visibility change across selected places, and where might nearby customers discover the business?
Use the business's saved neutral question families with location-specific versions across at least two places. Example: a Brooklyn hotel appearing for Brooklyn wording but absent for nearby Ridgewood wording.
Outputs: side-by-side prompt/provider/location recommendations, competitors, citations, gaps and source links; useful nearby-market opportunities with assumptions clearly labeled.
Keep intent/settings/repetitions consistent apart from explicit location differences. Record wording and supported geographic settings; named place does not simulate a physically located searcher. Do not assume the business serves every tested location.

## 5. Dashboard and timed bundles
Earlier dashboard monitoring concepts are future scope for AI Prompt Analysis. The current product delivers individual snapshots and separate rechecks.
Full brand/competitive/location analyses refresh on a slower monthly or twice-monthly cadence, to be selected and priced. Last/next update dates per module; no implied daily or real-time full analysis.
Timed bundles deliver defined reports periodically without assuming full dashboard access. Bundle cadence, entitlement quantities, recurring billing terms and dashboard inclusion remain open.
Account access to purchased reports and setup is not the same as an active monitoring subscription.
Do not charge for undefined plans.

## Saved prompts and evidence
Prompt library belongs to the business. Retain question ID, exact wording/version, intent/category, priority/order, language, explicit location and approval. Location variants link to the same family; ordering changes are not wording changes.
Reuse approved prompts by default across applicable products. Offer additions transparently; changing a monitored question starts a new series/version.
Task kinds: unbranded discovery, named-brand analysis, explicit comparisons, evidence assessment, opportunity generation, advice synthesis. Only actual unbranded answers contribute to discovery counts.
Distinguish negative mention, recommendation, ambiguous identity, absence, no business recommendation returned and failed request.
Count each cited page/domain once per answer in its respective frequency table; preserve raw annotations. No source-content claim from URL alone.
Compatible evidence reuse must preserve timestamp, settings and permissions; no stale substitution or counting reused answers as independent runs.
