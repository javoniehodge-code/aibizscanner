# Claude Design — website skeleton brief
Version 0.3 • 22 October 2026

## Task
Create a clickable, responsive website skeleton for **AI Biz Scanner** using the pages and flows below. Begin with layout, hierarchy and realistic labeled sample content. This is a design prototype, not a production API/payment integration.
Use plain English and reusable page/form/table/card components. The route and section labels below are proposed design defaults. Preserve confirmed product behavior; do not invent pricing, limits or integrations.

## Navigation and pages
Header: **Products** dropdown, Pricing, Sign up, Log in, primary **Free visibility check** action. Logo returns home.
Products contains AI Prompt Analysis, Brand Strength Analysis, Competitive Analysis, Location Analysis and Monitoring Dashboard.
Footer: methodology, learning resources, privacy, terms and help; supporting copy can be labeled placeholder content.

| Page/template | Main content |
| --- | --- |
| Homepage | Scroll narrative below; previews connect problems to products |
| Products overview | Four report cards and subscription dashboard; link to each detail page |
| Four report detail pages | Who it helps, questions answered, sample output, included scope, FAQs and purchase action |
| Dashboard product page | Scheduled prompt checks, slower full analyses, history and checklist; subscription terms TBD |
| Pricing | One-off reports, timed bundles and dashboard subscription; only visibility has a free five-prompt version |
| Free scan | Business inputs, five-prompt review, progress and free results |
| Signup/login/recovery | Account entry, accessible form states and baseline onboarding |
| Checkout | Name/email/business details, signup/sign-in and payment summary |
| Report setup and progress | Confirm facts, choose competitors/locations where relevant, approve questions/scope, run |
| Four report result templates | Shared evidence shell with distinct product content |
| Account workspace | Reports/unfinished purchases, subscription dashboard, checklist, business setup and billing |
| Supporting public pages | Methodology, sample results and useful learning content; do not expose customer reports |

Paid purchases require an account. A basic account can hold purchases without a monitoring subscription. Gate monitoring features with a subscription explanation; do not gate already purchased reports.
Dashboard is in the design scope; release timing and full plan details remain open.

## Homepage scroll narrative
| Order | Proposed heading | Show | Link/action |
| --- | --- | --- | --- |
| 1 | See how AI presents your business—and when it recommends someone else | One relatable customer question and a compact illustrative AI answer/table | Free visibility check; secondary Explore products |
| 2 | What does AI understand about you? | Short brand description, source and example concern | Brand Strength Analysis |
| 3 | Do you appear when customers ask? | Five-row question × AI preview with recommendations/citations | AI Prompt Analysis |
| 4 | Why does AI favor a competitor? | Side-by-side evidence statuses and stated rationale | Competitive Analysis |
| 5 | Could nearby customers be missing you? | Same need across two locations, such as Brooklyn/Ridgewood hotels | Location Analysis |
| 6 | Make changes. Track what happens next. | Dated prompt trend and task moving through verification | Monitoring Dashboard |
| 7 | Choose your starting point | Free visibility, one-off reports, scheduled bundles, subscription | Pricing/product choices |

Avoid a wall of questions, technical acronyms and unexplained feature cards. Each section says what the customer learns and shows the output.
Label all examples “Illustrative sample.” Do not fabricate testimonials, audience statistics, success rates or live provider responses.

## Free journey
Enter business name/site and relevant location, optional competitors → select/edit/approve five prompts → start → progress → results.
No upfront email/account. Results remain visible before the optional “Email my report” or “Create an account for next time” prompts.
Email delivery uses a verification state. Signup can preserve this scan only after ownership is validated.
No free Brand Strength report.

## Paid journey
Choose product → checkout details and create account/sign in → complete payment → finish report setup and approve prompts/scope → run → account results.
Checkout is short, with a purchased-scope summary from the product page. No guest checkout.
A returning customer reuses their business details and saved questions. Payment comes before final question selection; do not start AI tests automatically from payment success.
Interrupted purchase setup appears as “Finish setup” in Reports and never asks for duplicate payment.

## Business onboarding
Separate steps/panels:
1. Business facts: import public information, show source/date, approve/correct/unknown.
2. Locations and selected competitors.
3. Priorities: desired description, priority products/services, preferred customers/locations and goals.
4. Suggested/saved prompt set with reorder/pin/edit/approve.

Facts and priorities must look distinct. Owner corrections preserve observed values and may generate discrepancy tasks.
Priorities influence which prompts are prominent; do not imply they control AI answers. Save progress and avoid forcing duplicate onboarding on returning customers.

## Account workspace
Proposed sidebar: **Overview, Reports, Prompts, Brand & Competitors, Locations, To-do list, Business profile, Billing**.
- Overview: subscription state, key prompt counts/trend, last/next checks and priority open tasks.
- Reports: purchased reports, unfinished setup and access to new purchases.
- Prompts: saved question set, priority order, pin/reorder, versions, provider evidence and monitoring history.
- Brand & Competitors: five evidence buckets and comparison for up to four competitors, each with its own refresh date.
- Locations: side-by-side report and last/next update, distinct from three-times-weekly prompting.
- To-do list: open, awaiting verification, could-not-verify and completed history, with evidence drawer.
- Business profile: observed versus owner-confirmed facts separately from priorities/goals.
- Billing: one-off purchases, timed bundle/subscription placeholders, renewal/cancellation state designs.

Prompt monitoring is **three times per week**. Brand/competitive/location refresh is **monthly or twice monthly—TBD**. Display separate dates. Never say daily, continuously or real time.
Use actual plotted sample points with labeled illustrative data; missing observations appear as gaps, not zeros. A trend line, if shown, is labeled.
Do not assume 50 prompts is a plan cap; it is an example.

## Report result templates
Shared top: product, business, date, language, locations/providers and completeness. Executive summary first. Actions: Download PDF and Email report. Evidence opens inline or in a drawer.
- **Visibility:** prompt × four-AI table, recommendation/mention distinctions, competitors appearing, gaps and top citations.
- **Brand Strength:** AI perspectives/sources, suitable/unsuitable situations, five status buckets, discrepancies, prioritized next steps and creative discovery ideas.
- **Competitive:** target plus up to four competitors; comparable five-bucket statuses, what each does well/poorly, stated AI rationale and learning opportunities.
- **Location:** matched customer needs across places, competitors/citations and nearby-market ideas.

Status buckets: accessible business information, independent validation, customer review evidence, expertise/supporting evidence, information currency.
Use green “In good shape,” yellow “Needs attention,” red “Issue found,” gray “Could not assess” or “Not applicable,” always with icon and text. No numeric grades.
Opening a bucket reveals specific evidence, checked sources/date, interpretation, next step and verification method. No “green guarantees more recommendations” claim.

## Checklist example
Use an illustrative hours mismatch:
- Owner confirms 7 p.m.; website and AI answer say 5 p.m.
- Website correction task can be Verified complete after a successful page recheck.
- AI discrepancy remains unresolved until its applicable sampled-answer check passes.
Show source/date, observed versus confirmed fact, action, last checked, verification and history.
Statuses: Open; Owner marked done—awaiting verification; Verified complete; Could not verify. Strategic ideas may be Owner completed, explicitly separate.
Completed tasks remain in history and recurring issues reopen. Never auto-check a task just because an owner clicks done.

## Essential prototype states
Include: profile fetch failure/manual fallback; empty/invalid questions; checkout declined; paid order awaiting setup; scan running/partial/all failed; zero recommendations; missing provider data; insufficient evidence; email pending/expired; invalid/expired report; unsubscribed workspace; no history yet; task reopened.
Design mobile tables/cards, long URLs/answers, readable contrast, keyboard focus and text labels for status colors.

## Scope and handoff
Use ChatGPT, Claude, Gemini and Perplexity as coverage labels; no Google AI Overviews, agency packs or live integrations.
Integrations are a separate backlog. Do not create working GBP management controls or promise access.
Use “Price TBD,” “Paid scope TBD” and “Refresh cadence TBD” where unsettled.
Make the key journeys navigable with mock states; no real charge, email or scan. Do not generate backend architecture as part of the skeleton.
First pass: all pages as rough connected frames. Second pass: polish the visibility flow, then reuse components across other products.

## Approved Brand Perception section override — 23 October 2026
For the renamed **AI Brand Perception Audit**, use [Section 1: Website discovery and accessibility](ai-brand-perception/sections/website-discovery-accessibility/README.md) and its linked image, webpage reference and fixture. The approved first section takes precedence over older generic Brand Strength bucket/color layouts for that section. All-black text on white, plain English, named linked pages and consistent selected-page counts are required. Keep outcomes simulated until actual evidence exists. Do not redesign or finalize the other report sections in this handoff.
