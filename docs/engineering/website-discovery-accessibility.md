# Website discovery and accessibility: implementation process

Version 1 proposed implementation plan • 23 October 2026

Implements the approved [Section 1 design](../product/ai-brand-perception/sections/website-discovery-accessibility/README.md). The design and its communication requirements are approved; engineering defaults below are proposed. No scanner, database migration or live provider validation is implemented by this document.

## 1. What the pipeline produces

Given a public business website and an owner-reviewed selection of important pages, produce:

1. Published search-crawler permissions per relevant provider/route.
2. Page-by-page search discovery observations per provider.
3. Separate direct-URL content-availability observations per provider.
4. Evidence-backed labels and summaries with a consistent selected-page denominator.
5. Plain-English findings identifying the exact pages, uncertainty and owner options.

This is a named-website diagnostic, not an unbranded buyer recommendation test. Do not add these calls to visibility/recommendation totals. API tests reflect the configured provider tool, not guaranteed behavior in its consumer app.

## 2. End-to-end sequence

| Step | Service action | Saved output | Owner experience |
| --- | --- | --- | --- |
| Discover | Read homepage, sitemap references and bounded internal links | Candidate page inventory and collection limits | Pages found on the site |
| Select | Suggest customer-decision pages; owner reviews/adds | Frozen selected page IDs, URLs and reasons | Exactly which pages will be checked |
| Inspect | Fetch public rules and selected pages through our protected fetcher | Access rules, response observations and content references | Website permission and supporting website checks |
| Search | Use each provider's actual web-search capability | Returned source URLs, executed queries/tool events | Did this platform surface the page? |
| Open | Use each provider's supported URL-reading capability | URL-specific retrieval evidence and content observations | Was this page's information available? |
| Evaluate | Match page identity and validate returned content | Deterministic statuses, evidence IDs and uncertainty | Found & read / partial / not tested / not confirmed |
| Assemble | Compute summaries from selected-page records | Frozen version of the report section | Consistent counts, exact pages and practical findings |

Run work in durable server-side jobs under the existing scan entitlement, budget and retry controls. Do not hold a webpage request open while all providers run.

## 3. Discover and select pages

### Site discovery

- Normalize the submitted HTTP(S) URL. Resolve safe redirects and preserve submitted, resolved and canonical identities.
- Fetch the homepage and robots file; parse advertised sitemap locations and sitemap indexes within configured size/depth/request limits. Supplement with same-site navigation links.
- Respect collection rules and stop limits. Do not circumvent challenges, authentication or explicit restrictions. If our fetcher cannot inspect a page, record that limitation; owner entry remains possible.
- Exclude cart/account/search/filter duplication and assets from candidate HTML pages. Preserve meaningful product, service, FAQ, policy and location variants.
- Record candidate count and how it was collected. Call it “pages found,” not the website's true total. An incomplete crawl does not establish full site size. Preserve `total_site_pages: null` unless a defensible inventory scope is explicitly established.

### Selection

Suggest pages based on customer decision needs for the business type. Include relevant homepage/catalog pages and product/service, pricing, FAQ, policy, contact and location pages. Do not select merely the first six URLs. Use deterministic page classification where possible; a model can assist classification with evidence and a reason, but cannot invent pages.

Show candidate titles, URLs and selection reasons. Owner may add/remove pages within purchased scope. Freeze the selected list before a scan. An added page or changed selection creates a new configuration/version, not a silent denominator change. A relevant page not found in our bounded discovery is a separate inventory observation, not an AI search failure.

### Our content reference

Fetch selected URLs once through our own labeled fetcher. Store final URL, timestamp, status, visible main text, headings, content hash and a bounded snapshot in private storage. Record script-rendered content only when an authorized rendered-browser fallback is actually used; do not call ordinary raw HTML a browser rendering.

Select two short, page-specific reference passages from text actually present for use by the evaluator. This is a proposed check policy, not owner onboarding. Do not send these passages or our page scrape to the provider during access tests. If a product fact is absent from the source itself, that belongs to completeness assessment, not an unreadability failure.

## 4. Check published access permissions

Maintain a versioned provider-route registry sourced from official provider documentation. Store search-crawler tokens separately from user-directed retrieval and training tokens. For Google, explicitly distinguish Google Search/Googlebot from the configured Gemini URL/search route.

For each selected URL and applicable crawler, evaluate the domain's robots rules using a tested standards-aware parser, including path specificity and provider-documented differences. Store the snapshot, matched rule, affected paths, collection time and parser/registry versions.

| Permission result | Evidence required |
| --- | --- |
| Allowed | Successfully inspected policy and no applicable disallow for this URL, or a correctly interpreted policy absence under the relevant rules |
| Blocked | Applicable published rule explicitly disallows the URL for the registered search crawler |
| Unconfirmed | Rules unavailable/ambiguous, registry mapping unsupported or evidence insufficient |

Do not interpret a 403/timeout fetching robots as an explicit disallow rule. Handle 404/other statuses according to the adopted robots standard/provider behavior and preserve the reason. Rule permissions can vary by path: show Mixed/“Some pages blocked” with affected pages if needed, rather than saying the whole site is blocked.

This check establishes published permission only. CDN/security blocking needs an observed applicable response or verified logs; impersonating a crawler's user-agent does not verify access from that provider's network.

A search-crawler disallow does not automatically cancel a separately supported user-directed URL test. Follow each tool's applicable permissions; do not bypass restrictions. If a test is skipped, record its reason and display Not tested rather than a failure. The approved Claude example is one illustrative not-tested state, not a production rule that search blocking proves all reading is impossible.

## 5. Provider capabilities: validate before promising results

Use four direct provider adapters. Each adapter must prove its available capabilities with controlled smoke checks before enabling a result column. Verify model/tool availability, exact SDK/API syntax, metadata, limits and costs at implementation time. Do not hard-code current model names or assume consumer-app equivalence.

| Provider | Search mechanism to investigate | URL-reading mechanism to investigate | Evidence limitation |
| --- | --- | --- | --- |
| OpenAI | Native web-search tool; preserve searches, sources and citations | Tool-supported page-open action when available on the selected model/tool | Some tool configurations expose only selected sources; a citation alone does not establish full-page reading |
| Anthropic | Native web search | Native web fetch | Check supported model/tool combination, actual URL fetch result and citation/content blocks |
| Google Gemini | Google Search grounding | URL Context | URL Context may use an internal cache before live fetch; success does not prove a fresh server visit |
| Perplexity | Native Search API or native web-search tool, with route labeled | Native URL-content tool if available in the configured API | Validate that the selected native model/tool meets the project's direct-provider policy; do not silently substitute a third-party frontier model |

If a provider lacks provable URL-reading metadata in the chosen configuration, reading is Unconfirmed or Not tested with a capability reason. Never fetch the page ourselves, paste it into the provider and call that provider access. An external scraping tool is our access, not the AI provider's.

## 6. Search test: can it surface each selected page?

Use a fresh isolated request per provider/page. A proposed shared query template is:

`Find the official [business name] page for [page purpose / product / service]. Return the relevant official page and the sources used.`

Include the brand and the same business context needed to avoid namesakes. Do not provide the target URL or scraped page text in this primary discovery test. Save the exact template/version, instantiated prompt, language, configured market, model, search settings and actual executed search queries when exposed. These are branded navigational diagnostics, not neutral buyer prompts.

Require observed tool execution. A request to search is not proof a search occurred. Match the selected URL against actual returned search results/source records, not URLs invented in prose. Preserve whether a match was a search result or a final-answer citation; do not equate the two.

URL matching uses normalized host/path and protected redirect/canonical checks; strip tracking parameters without collapsing distinct variants. A home-page match cannot satisfy an individual product-page test. A retailer's copy of the product cannot satisfy an official-page test. Ambiguous identity is Unconfirmed.

Completed search without a matching URL means Not found in this test. Provider errors, search not invoked, incomplete metadata or unsupported capabilities mean Unconfirmed/Not tested, not Not found. Optional domain-restricted or exact-title searches are separate diagnostics and must not retroactively replace the initial outcome.

## 7. Reading test: can its web tool obtain that page's information?

Independently provide the exact selected URL using a supported URL-reading tool. Proposed instruction:

`Open this official page: [URL]. Report the page title and two short, page-specific passages from its main content. If the tool cannot retrieve it, state that. Do not answer from general knowledge or other pages.`

Do not supply source passages or expected facts. Record tool events and retrieval-status metadata, returned/resolved URL, returned content/excerpts and citations. Our evaluator checks identity and whether the response contains page-specific information supported by the independent reference snapshot or adequate provider-returned page content.

Validation policy:

- **Readable:** URL-specific successful retrieval evidence plus sufficient main-content evidence under the versioned rule. Matching snippets alone do not establish full-page reading.
- **Partially readable:** Tool success but only limited meaningful main content available, with the limitation identified.
- **Unsuccessful:** An actual URL-reading attempt returned an error, challenge, refusal or unusable content; preserve the reason. Do not automatically call this a site block.
- **Unconfirmed:** The evidence cannot establish reading, tool activity is missing, only a search snippet is available, or page/reference identity remains ambiguous.
- **Not tested:** No attempt, including unsupported capability or an explicitly recorded policy/budget skip.

“Readable” means enough page information was returned under this test; it does not certify that every word or fact was extracted. A full content-quality audit is a later section.

Store `retrieval_provenance` as live, cached, or unknown only when supported by tool metadata. Preserve unknown rather than guessing. Cached success can demonstrate information availability, but cannot verify current direct network access or close a website firewall/crawler task. A crawl/currentness mismatch can require review without turning it into a fabricated failure.

An LLM may assist passage matching with quoted evidence, but cannot overrule missing tool provenance or create citations. Treat page/model text as untrusted input, never execution instructions.

## 8. Results and summaries

Evaluate rules in application code, not by asking each model for an overall grade.

| Search result | Reading result | Display |
| --- | --- | --- |
| Found | Readable | Found & read |
| Found | Unsuccessful | Found, but could not read |
| Not found | Readable | Read using direct link; not found in search |
| Not found | Unsuccessful | Not found or read; reason not confirmed unless evidenced |
| Any | Partially readable | Show search outcome plus “Partly read”; retain limitation |
| Not tested | Not tested | Not tested |
| Unconfirmed / mixed execution | Any | Expose exact known/unknown states, never silently count unknown as a miss |

Compute `found_and_read_count` only from selected rows with found + readable. Denominator remains all selected pages (`selected_page_count`). Show execution coverage separately when tasks are incomplete. If no tasks ran, count is null and summary says Not tested, not 0 of N. A lower successful-page subset never becomes a new denominator.

Published permissions are shown in a separate matrix. They do not control observed search/reading labels. Search results do not establish current indexing status; indexing and verified crawler visits remain separate optional records.

Owner-facing findings are generated from concrete observations with affected page links. “Your published rules block Claude's search crawler” is permitted with rule evidence. “This is why Claude never recommends you” is not. Failure reasons stay unknown unless evidenced. Provide owner options, without requiring an impact forecast to surface a confirmed restriction.

## 9. Data and job records

Extend the existing private evidence/scan architecture rather than storing results in Git:

- `website_page_inventory`: URL identities, discovery method, page kind and selection reason.
- `website_assessment_configs`: frozen selected pages, provider routes, query/evaluation versions, locale and caps.
- `website_policy_observations`: matched crawler/path policy and evidence snapshot.
- `website_page_checks`: unique scan + provider route + page + check kind; separate search/reading tasks.
- `website_check_attempts`: request/tool IDs, start/end time, actual usage, attempts/errors, provenance and raw private evidence references.
- `website_section_versions`: derived display rows, coverage, findings and immutable evidence/config references.

These are logical proposed entities, not approved migration names. Reuse existing scan tasks/attempts/source records when appropriate. Keep evidence storage tenant-scoped, private, redacted and subject to retention policy. Do not store sensitive evidence or API keys in the public repository.

The design fixture remains valid sample data. Production records additionally require tool/model identifiers, URL-match evidence, reading-validation evidence, retrieval provenance, attempt coverage and uncertainty. Null evidence in a fixture never becomes a real pass.

## 10. Budgets, safety and retries

Proposed simplest test scope: one primary search and one reading task per selected page/provider. For N pages and four providers, that is 8N logical provider tasks (48 at N=6), plus bounded site inspection. Actual billed model/tool calls can be greater because of tool steps, retries or supplemental diagnostics. Reserve cost using measured provider usage, not this task count as a price quote.

Page caps, provider/model versions, search limits and retry policy must be configured and disclosed before sale. Do not infer a six-page plan limit from the example. Reuse a robots snapshot safely within one run where applicable; do not count cached tasks as new independent observations. Deduplicate execution using scan/config/page/provider/check IDs.

Retry only bounded transient provider/network failures; preserve attempts and final uncertainty. Do not retry explicit restrictions to bypass them. Unsupported tools remain Not tested. The report can complete partially with honest coverage.

Our fetcher validates public HTTP(S) URLs, DNS and every redirect; blocks private/loopback/link-local/metadata destinations; and caps response bytes, time, redirects and content types. Avoid arbitrary remote execution and prompt-injection instructions. Rate-limit site inspection and respect access constraints. Freeze report/export rendering so opening or exporting results never triggers new provider calls.

## 11. Implementation order and release checks

1. Build protected site inventory and explicit page selection; connect to the approved UI with the fixture.
2. Add versioned route registry, robots interpretation and evidence snapshots.
3. Validate all four provider routes with controlled test pages before promising results: accessible static page, deliberate crawler disallow, script-only content, redirect, changed/cached content and a failing URL. Record capability differences.
4. Implement isolated search and reading tasks, URL matching and content validation.
5. Add deterministic display mappings, counters, coverage and owner findings.
6. Validate a real end-to-end scan using authorized paid API keys; inspect tool evidence and cost. No such scan was run for this document.

Required acceptance cases:

- Same six-page fixture produces 6, Not tested, 4 and 5 successes; denominator always six.
- Search-blocked but user-fetch-readable can coexist without contradiction.
- A provider asserting “I read it” without tool evidence cannot pass.
- A correct answer based on a third-party copy cannot pass an official-page access test.
- Direct-URL success does not count as search discovery.
- Failed/incomplete provider request does not become a page-not-found result.
- Cached success does not verify a live server visit or close an access-block task.
- Missing source facts do not become unreadability failures.
- Partial path restrictions and ambiguous Gemini routing remain scoped and visible.
- Added/removed selected pages create a new version; historical totals stay unchanged.

## 12. Official references reviewed

Capabilities change; recheck at implementation. Access to docs is not a successful API smoke test.

- OpenAI web search: https://developers.openai.com/api/docs/guides/tools-web-search
- OpenAI crawler purposes: https://developers.openai.com/api/docs/bots
- Anthropic web search: https://platform.claude.com/docs/en/agents-and-tools/tool-use/web-search-tool
- Anthropic web fetch: https://platform.claude.com/docs/en/agents-and-tools/tool-use/web-fetch-tool
- Gemini Google Search grounding: https://ai.google.dev/gemini-api/docs/google-search
- Gemini URL Context (including cache-first behavior): https://ai.google.dev/gemini-api/docs/url-context
- Perplexity Search API: https://docs.perplexity.ai/docs/search/quickstart
- Perplexity URL-content tool: https://docs.perplexity.ai/docs/agent-api/tools/fetch-url-content

## Open engineering choices

Exact model/tool combinations and API versions; purchased page/call caps; robots parser and route registry implementation; query limits; passage-validation thresholds; retry/time budgets; evidence retention; and optional owner log/search-tool integrations. Validate capabilities before promising identical features across all providers. These choices do not block the approved mockup, but do block unsupported production claims.

## Shared model-history requirement — 24 October 2026
Retain this section's established four-model permission/search/reading separation and follow the [common history/provenance pipeline](multi-model-brand-perception.md). Compare exact selected pages and dimensions per provider across compatible runs. A failure or untested provider stays visible. Model/version/tool/inventory changes create a disclosed history boundary; supplied-content success in Section 2 is not a discovery/accessibility test.

