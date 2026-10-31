# Competitive Analysis Report — product specification
Date: 2026-10-31
Status: approved product direction and illustrative report; not an implemented research pipeline.

## Purpose and scope
Help owners compare their actual business with competitors they select, on criteria they choose, and identify practical competitive advantages, weaknesses and opportunities. AI gathers and organizes evidence; model opinions are not a report section.

This direction supersedes earlier concepts that made Competitive Analysis principally a comparison of AI recommendations or required AI to choose competitors. AI Prompt Analysis retains prompt visibility and mention comparisons. This report addresses business offerings, pricing, customers, reputation and commercial positioning. It is distinct in purpose; no claim is made here that every existing repository document has been reconciled.

## Owner setup
1. Confirm the business and specific location or service area.
2. Choose competitors. Suggestions can assist discovery, but the owner controls the comparison set.
3. Choose approximately 5–10 meaningful comparison points from an industry-specific shortlist.
4. Optionally add a custom comparison question or customer need.
5. Confirm comparable conditions (dates, units, geography, package, customer count and relevant policies).
6. Generate the report with scope, evidence dates and missing information visible.

The 5–10 range is a design target, not a finalized billing limit. Competitor limits and pricing remain undecided.

## Suggested comparison library
- Prices, required fees, optional charges, inclusions, bundles and memberships.
- Products, services, amenities, room/product variants and availability.
- Opening hours, service hours and access.
- Physical locations, neighborhoods and areas served.
- Policies, restrictions, deposits, cancellations and accessibility.
- Target customers and positioning: explicit published claims versus inferred fit.
- Review rating, count, recurring praise and complaints.
- Purchasing/booking journey, clarity and convenience.
- Online presence and source quality where selected: distinguish quality of evidence from quality of business.
- Changes since a prior comparable report.

Adapt criteria by industry. Hotels are an example, not the universal schema. Brand perception here means customer reputation and market positioning supported by reviews and published messaging, not how each AI describes the brand.

## Report structure
1. **Competitive snapshot:** owner alongside competitors; selected criteria as rows; succinct values and evidence references.
2. **Executive assessment:** strongest position, important disadvantage, most credible opportunity, and limitations.
3. **Price/value analysis:** normalized base price, taxes, mandatory fees, optional extras and total cost under stated scenarios. Explain material product differences.
4. **Customer needs and offer fit:** identify which published capabilities serve each selected customer need. Do not invent guest demographics.
5. **Review analysis:** ratings and counts by platform, comparable sampled periods, theme counts and denominators, linked examples and sampling limits.
6. **Positioning and purchasing experience:** advertised promise, supporting evidence, booking clarity and friction that can actually be observed.
7. **Prioritized opportunities:** evidence, implication, action, approximate effort with uncertainty, prerequisites and an outcome metric. Separate observed findings from hypotheses.
8. **Evidence and unresolved questions:** sources, capture dates, conflicts, confidence rationale and unavailable data.
9. **Change tracking:** first report establishes a baseline; later versions distinguish real changes from newly discovered information.
10. **Three-action takeaway:** a clear advantage to communicate, a competitive gap to evaluate and an information gap to fix.

Render only relevant sections for selected criteria. Selection changes in production must propagate through tables, findings and recommendations, not just hide columns.

## Evidence and fairness rules
- Every substantive factual claim needs a source URL, capture timestamp, excerpt or structured observation and business/location attribution.
- Store published claims separately from independently corroborated facts and analytical inferences.
- Not found is not equivalent to unavailable, false or absent. Distinguish not applicable, inaccessible, conflicting and stale information.
- For prices, match dates, occupancy/quantity, currency, taxes, product class, inclusions, payment and cancellation terms. Mark unavoidable differences; do not rank noncomparable prices as equivalent.
- Dated hotel quotes do not establish an always-cheapest claim. Separate mandatory totals from optional scenarios such as parking.
- Match review platforms and collection periods. Show sample sizes; themes may overlap. Do not mix platform rating scales or present sample frequency as population prevalence.
- Source quality concerns attribution, recency, directness, corroboration and agreement. A weak web presence does not establish an inferior business.
- Customer focus may be inferred from offerings and messaging; label it as inference. Actual customer mix requires additional evidence.
- Recommendations about investment require explicit uncertainty and demand/cost validation. Do not invent revenue lift, margins, market share or implementation costs.
- Owner-supplied facts must be labeled and discrepancies retained, not silently treated as independently verified.
- Missing access or collection failure must produce a visible limitation rather than fabricated evidence.

## Minimal data model
| Object | Required fields |
|---|---|
| Report | id, business_id, location_scope, competitor_ids, criterion_ids, custom_questions, generated_at, comparison_conditions, prior_report_id, limitations |
| Business | id, name, official_url, location/service_area, owner_or_competitor |
| Criterion | id, label, category, industry, unit, normalization_rules |
| Observation | business_id, criterion_id, raw_value, normalized_value, status, evidence_ids, observed_at, comparable, caveats |
| Evidence | id, url, publisher, source_type, captured_at, published_at_if_known, excerpt, claim_scope |
| Review sample | business_id, platform, date_window, collection_method, sample_count, rating_scale, theme_counts, evidence_ids |
| Finding | id, category, statement, supporting_observation_ids, confidence_rationale, inference_flag, limitations |
| Action | finding_ids, action, rationale, priority, effort_assumption, prerequisites, success_metric |
| Change | prior_observation_id, current_observation_id, change_type, effective_date_if_known, comparability |

Finding categories include advantage, offering gap, information gap, reputation issue and opportunity hypothesis. Confidence labels need reasons, not arbitrary scores.

## Workflow
Collect selected evidence → normalize comparable observations → detect conflicts and gaps → generate evidence-linked findings → prioritize practical actions → render report → retain baseline for later comparisons. Reuse evidence across reports when relevant and current, while preserving each report's distinct purpose.

The paid value is normalized comparisons, verifiable research and useful interpretation, rather than a long inventory of facts.

## Presentation
- All text black; no gray text.
- White/light surfaces, readable tables and clear owner-column distinction.
- Source details and limitations available without obscuring the quick comparison.
- Web-first report; exact PDF export implementation remains separate.
- All illustrative or synthetic data prominently labeled.

## Visual reference
[Detailed illustrative hotel report](../visuals/competitive-analysis-hotel-example.html)

Download the HTML and open it in a browser to view the standalone interactive visual. All hotels, prices, reviews and evidence labels are fictional. It is a design example, not a real market study.

Preview limitations: criterion and competitor toggles update the opening snapshot only; detailed sections remain the fixed example. Custom-question input does not run research. Production must regenerate the full report for the selected scope. Superseded hidden AI-perception content was removed from the exported visual, and cancellation/price assumptions were aligned.

## Open implementation decisions
Competitor count limit; final criterion limit; supported research sources and access; review collection coverage; report pricing; scheduled refresh cadence; handling failed or partial research; export format details. These are not settled by the mockup.
