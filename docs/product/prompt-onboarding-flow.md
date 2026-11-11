# AI Prompt Analysis — onboarding structure

Status: approved structure. Documentation only; no visual or application implementation is included.

## Flow

Confirm business → choose research topics → review and approve questions → scan.

This is the report-setup flow. Reuse details already collected in checkout or an existing business profile. Account, payment and free-report access rules remain governed by [user flows](user-flows-and-rules.md).

## Step 1 — Your business

Owner provides business name, website and location or market. Extract category, offerings and apparent service area from the website, then let the owner correct them. Offer manual entry when extraction fails.

Separate physical location from where the business serves customers:
- Local/service-area business: suggest nearby cities or neighborhoods and ask the owner to confirm actual coverage; allow additions.
- Online/product business: confirm countries, shipping markets or availability.
- Both: collect the relevant parts of each.

An owner-confirmed service area may extend beyond the website's stated coverage. Preserve both observations rather than overwriting the website evidence.

## Step 2 — Research topics

Show extracted products/services as editable, selectable options. Let owners confirm what they offer, select up to five priorities and add missing offerings or topics. They can enter a topic without writing a finished prompt.

Optional inputs:
- “What do customers commonly ask before buying or booking?” Accept their wording.
- “Already have questions you want us to test?” Accept existing prompts.

Keep optional inputs optional. Generate a useful starter list from the website and essential confirmations. Owner priorities guide coverage and order; customer-demand evidence supports likelihood of use. Keep priorities separate from facts. Do not ask for desired positioning or require customer personas.

## Step 3 — Review questions

Generate a draft using the [prompt guidelines](visibility-prompt-guidelines.md). Group it into general baseline, products/services and adjacent needs. Explain briefly why each question matters and identify exploratory topics.

Allow the owner to edit, remove, add, reorder and approve questions. Include:
- 2–5 nearby-area variants when geography applies, within the expanded 25–50-question target.
- Selected one-level A/B follow-up tests when clarification could materially change recommendations.
- Relevant owner-supplied questions, checked for neutral wording and fit.

The free report selects five questions using the same process. Branch availability and allowance accounting must be defined within the purchased/free scope before execution; this approval does not create new free entitlements or fix paid limits.

## Approval and handoff

Confirm the selected offerings, areas, exact prompts and any branch replies. Save the approved question-set version and execution scope. Preserve drafts so owners can return without retyping or paying twice.

Run neutral discovery without attaching the business profile or priorities. Store answers, sources and results for each model; keep initial and branch observations separate.

## Handoff to the website audit

Confirm services and locations once during onboarding. Reuse the confirmed business profile when the website audit starts, including when the owner upgrades from an existing Prompt Analysis. Do not ask the owner to re-enter or reconfirm the same facts.

After Prompt Analysis runs or a compatible run is reused, build the proposed page list from the confirmed offerings and locations, the website inventory and relevant own-site citations. Include every individual service page discovered, plus applicable pages customers use to decide or book, whether or not they were cited. Count each unique page once.

Show **“Here are the pages we’ll check”** with page names and links. Let the owner approve the list or add a missing page before the audit runs its direct-link and crawler-permission checks. This is a scope review, not a second onboarding form.

Ask for new information only to resolve a specific gap, and make it skippable. Example: “You confirmed that you move pianos. We couldn’t find a page that explains that service. Is there a link we missed?” If skipped, keep the owner-confirmed fact and report the gap as scoped to the pages checked. See [Find & Read page selection](ai-brand-perception/sections/website-discovery-accessibility/README.md#page-selection).

## Follow-up selection

Prefer questions where a short clarification changes the eligible solution, service or market, using actual customer questions or a relevant exploratory hypothesis. Avoid questions already specific enough to answer, irrelevant choices and branches that simply steer toward the target business.

Example: a broad plumbing recommendation followed by “For a home” versus “For a business,” only where relevant to the business's services. Fork both replies from the same initial conversation; do not send B after A.

Approved: one level with A/B branches. Still to resolve: the precise selection rubric, number of branched questions, how to handle different clarifications across models, and allowance/cost accounting. See the prompt guidelines for execution boundaries.
