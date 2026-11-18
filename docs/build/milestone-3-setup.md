# Milestone 3 setup: the website section

Milestone 3 fills the report's website slides (Find & read, Structured data, Clear & complete, Distinctive). It is
built in four parts; this page grows as each lands.

## Part 1: find pages, approve the list, take snapshots (stage 5)

Nothing to configure: no new keys, vendors or costs. Our fetcher only reads public pages.

1. Make sure the business has its **website** (and other domains) filled in on the business page.
2. Open the report → **Website pages** → **Find pages**. Within a minute (reload) the page lists what was found from
   the home page links, navigation and sitemap, with up to 12 pages ticked as suggestions: home, pages an AI cited in
   the prompt analysis, contact/booking/FAQ/pricing, one page per listed service, location pages, a policy page.
3. Untick or tick pages, add any that weren't found (one address per line), and click
   **Approve these pages and take snapshots**. The list is saved as a frozen version.
4. Within a minute, section 3 shows our snapshot of each page (status, title, word count, headings, structured data)
   and what each AI's **search crawler** may do according to the site's robots.txt.

What these checks are, and aren't:

- **Our fetch, not an AI's.** We fetch with an honest user agent (`AIBizScannerBot`). We never pretend to be an AI's
  crawler, retry a refusal or get around a challenge or login; a 403 or challenge page is recorded as it is.
- **Published rules only.** robots.txt says what a site permits; it doesn't prove what an AI fetched. A robots.txt
  that returns 403 or fails is "Unconfirmed", never "Blocked". A missing robots.txt (404) means no restrictions.
- **Safety.** The fetcher refuses private, internal and cloud-metadata addresses (at every redirect), other ports and
  embedded credentials, and caps each page at 2 MB and 15 seconds.
- **Bounded discovery.** "Pages found" is what these sources list, not the site's true size.

Crawler tokens checked (registry 2026-11-17): OpenAI OAI-SearchBot, ChatGPT-User, GPTBot; Anthropic Claude-SearchBot,
Claude-User, ClaudeBot; Google Googlebot and the Google-Extended control token.

## Part 2: can each AI find and read the pages (stage 6)

Runs on its own after the snapshots: for every approved page and each engine (ChatGPT `gpt-6-luna`, Claude
`claude-sonnet-5-5`, Gemini `gemini-3.5-flash-lite`), two tests. **This costs money**: two calls per page per engine
(24 per engine for 12 pages); expect roughly $0.50–1.50 per report, within the spending cap. The run monitor shows the
real figure.

- **Search test**: a fresh, branded question (e.g. *Find the official MVP Miami (Miami, FL) page about "FAQ's For
  Renting…"*), with web search on. Never includes the URL or our page text. **Found** only if that page is among the
  search results or citations. The home page or another site's copy doesn't count. No search observed = unconfirmed.
- **Reading test**: the engine's own page-reading tool opens the URL (OpenAI web search `open_page`, Anthropic web
  fetch, Gemini URL Context) and returns the title and two passages copied from the page. **Read** only when the tool
  opened that URL and two passages are really on the page (checked word for word against our snapshot or the content
  the tool returned); one = partly read. No tool activity = unconfirmed, never a failure. A failed fetch (e.g.
  `url_not_accessible`) = could not read. Content the tool returned is stored as its own evidence (`engine_tool`
  snapshot), separate from our fetch.
- **Combined** (section 4 of the Website pages screen): Found & read, Read using direct link; not found in search, and
  so on, with "x of N found & read" per engine; N is always every approved page.

Known limits: Gemini URL Context may answer from Google's cache, and none of the tools says whether content was live,
so provenance is "unknown". OpenAI's `open_page` reports no success status, so OpenAI reads rest on the passage check.
These are the providers' API tools, not the consumer apps. Lists approved before 17 Nov 2026 need approving again (the
search test needs the business name stored with the list).

## Part 3: does each page need JavaScript? (our check, stage 6)

Nothing to configure and no running cost: no keys, no vendor. The worker loads each approved page in its own headless
Chromium (the open-source `@sparticuz/chromium` build on Vercel, driven by `playwright-core`). It runs on its own after
the snapshots (`ws_render`), alongside the AI tests; for a report whose snapshots were taken before this existed, click
**Run** on "Website: JavaScript check (our browser)" in the run monitor. Section 5 of the Website pages screen shows the
result for each page.

- **What it compares.** The visible text of our plain fetch (what a reader that doesn't run scripts gets) with the same
  page after its scripts ran, using the same text extraction for both. Results: *Key facts load with JavaScript*
  (prices, phone numbers or opening hours appear only with scripts), *Much of the content loads with JavaScript*
  (at least 80 words and a quarter of the page only with scripts), *Mostly readable*, *Readable*, or *Couldn't check*.
  The evidence lists the facts and a sample of the lines that appear only with scripts. The browser's copy is stored as
  a `rendered` page snapshot, separate from our plain fetch and from the AIs' tool content.
- **Recommendation.** When key facts depend on JavaScript: "Your prices depend on JavaScript. Making them available
  immediately removes one potential barrier to reading them." (Phone numbers and hours get the same wording with their
  own names.)
- **The answer key for key facts.** The browser's copy is what a visitor sees, so its prices, phone numbers and opening
  hours are the answer key for the key-fact extraction below (our plain copy is used when the browser couldn't load the
  page). Each fact is marked *JavaScript only* when it isn't in the plain copy.
- **Ours, not an AI's.** This is a diagnostic that explains reading results; it is never shown as what an AI saw.
- **Safety, as for the plain fetcher.** Chromium never reaches the network itself: every request the page makes is
  fetched by the worker under the same rules (public addresses only, checked at every redirect, ports 80/443), and
  Chromium's own network points at a dead proxy. WebSockets are closed, service workers and downloads blocked, images,
  media and fonts skipped. Each page is capped at 150 requests, 10 MB and 45 seconds. The user agent is
  Chromium's own with `AIBizScannerBot/0.1` appended. A site that refuses our plain fetch usually refuses the browser
  too; that is recorded as *Couldn't check*, never retried or worked around.
- **When a site refuses our checker** (HTTP 401, 403 or 429), the page shows *Couldn't check* with an optional step for
  the owner: allow our checker (`AIBizScannerBot`) so we can score which key facts each AI missed and whether
  JavaScript is the reason. This only completes our answer key; what each AI can find and read comes from its own
  tools and is the same either way. Without it, the facts each AI listed still show the gap as evidence, unscored.
- **On Vercel** Chromium runs as a single process, which got stuck opening a second page in the same browser. So each
  page gets a fresh browser, closed afterwards, with a hard 45-second limit (the browser is killed and the page marked
  not loaded); a page that hit a crash is retried once; pages load one at a time; and the run stops starting pages
  after about 200 seconds (the rest say to run it again).
- **Keeping the best browser copy.** Sites can refuse our checker on one run and not the next, or serve a page but
  refuse the requests that load its content (MVP Miami's inventory, 17 Nov). So a refused or failed load, or one with
  much less content than our fullest earlier browser copy of that page (at least 50 more words and a quarter more),
  doesn't replace it: the earlier copy stays the comparison and the answer key, and the page shows its date and why.
  The page's own data requests that the site answered with an error are counted and reported, as the copy may be
  missing content.
- **Comparison copy.** If this run's plain fetch of a page failed, the browser's text is compared with our most recent
  good plain copy of that page, and the screen says so with its date.

### Key-fact extraction (part of the reading test)

The reading test also asks each AI to list the key facts it can get from the page: prices, phone numbers, opening
hours and the products or services offered, with no expected facts given. The combined step scores them against the
answer key: a fact counts when the AI listed the same value (prices by amount, phones by number, hours by times),
whatever its wording. Products and services can't be listed from a page by rule, so they're checked the other way: how
many of the names it gave appear on the page.

- **Partly read** when the AI read the page but missed a fact that loads only with JavaScript (the brief's rule:
  inventory or prices loaded only by JavaScript must surface as partly read), or missed most of the key facts. The
  reading test's own result is kept alongside, and the note says what was missed and why.
- **Counted as read** the other way round: when only one of its quoted passages matched word for word but it got every
  key fact on the page, the read counts as read (its passage result is kept alongside).
- Each engine's column shows "x of y key facts on n pages read".
- Reading tests run before 17 Nov 2026 didn't ask for facts; rerun them to get scores.
- Cost: the same calls with slightly longer answers (a few cents more per report).

Running it locally: set `CHROMIUM_PATH` to a Chromium binary (or install a Playwright browser).

## Part 4a: the website in the report (Find & read)

Nothing to configure, no cost. `ws_section` builds the report's website part from the approved pages, our snapshots,
the find & read results and our JavaScript check; it runs on its own after find & read, and report assembly then picks
it up. For a report whose website tests ran before this existed, click **Run** on "Website: build the report's website
section" in the run monitor; the report reassembles by itself.

- **Find & read slide**, one table per question so an owner can see exactly which step a page fails (owner, 18 Nov 2026):
  1. **Can AI find this page?** Yes / No / Not checked, from each AI's own search test.
  2. **Can AI access this page?** No when your robots.txt disallows that AI's crawler or page reader for the page, or
     your website turned its page reader away; Yes when its reader got the page or your rules allow it; otherwise Not
     confirmed.
  3. **Can AI read this page?** For pages it can access: Yes / Partly / No: needs JavaScript (it missed key facts that
     only load with JavaScript) / No / Not confirmed. Pages it can't access show "No access (step 2)".
  Each table has a count per AI and a "Why these answers?" list (the reader's reason and the key-fact score).
- **Raw vs fully loaded**: our JavaScript check for the pages it could check, labelled as our comparison.
- **What needs your attention**, one item per step and matching its table: pages no AI could find (step 1), each AI
  that can't access pages (step 2), pages an AI can't read because key facts need JavaScript, with the recommendation (step 3).
- The other website slides (Structured data, Clear & complete, Consistent, Distinctive) stay out of the report until
  their stages exist: each website part can now be absent on its own.

Engine: a stage can declare `optionalInputs`, read when they have a finished run and left out otherwise; report
assembly reads the website section this way, so a report without website tests still assembles.

## Part 4a (continued): Structured data slide

Nothing to configure, no cost. `ws_structured` runs on its own after the JavaScript check and compares the facts in the
site's code (JSON-LD) with what its pages show, in plain code. For a report that already has its website tests, click
**Run** on "Website: structured data check"; the website section and the report then update by themselves.

- **The code** is read from our plain copy of each page (what crawlers read); when this run's fetch was refused, from
  our latest good plain copy (dated), else our browser copy. **The page facts** come from our browser copy (what a visitor
  sees), else the plain copy.
- **Facts compared**: business name (with the approved business name), phone, address (the code's street or postal code
  on a page), opening hours (both schema.org forms), prices (pages show prices; does the code state any beyond a price
  range?) and FAQ pages (marked up as questions and answers?). Each is a match, a conflict, or missing from the code; a
  fact only the code states is not judged. Code that isn't valid JSON is reported as broken.
- **The slide**: pages with structured data, facts that match, conflicts, facts missing from the code; each problem in
  plain English with technical details for the website manager (page, where in the code, what each side says, the fix);
  and every fact compared.

## Part 4b: Clear & complete

Does the website give a customer (and AI) enough detail on the facts that decide whether they choose the business?
**This costs money**: about $0.10–0.25 per report (Claude's answer is most of it), within the spending cap.

Five stages (module `content`), all run on their own after the JavaScript check:

1. `cc_bundle` (plain code): the business's **approved decision-fact list**, chosen from its category
   (`web/src/engine/modules/content/standards.ts`; car rental v1.0 approved by the owner 18 Nov 2026, plus the boutique
   hotel and coffee lists from `docs/product/ai-brand-perception/decision-fact-standards.md`), and the page text every
   assessor sees: our browser copy of each approved page (what a visitor sees), else our latest good plain copy;
   2,500 words a page, 20,000 in all. A category with no approved list stops with a clear message (run with
   `{"standard": "<id>"}` to choose one).
2. `cc_baseline` (one Claude Haiku call): **our assessment of the website**, fact by fact: enough detail, some detail
   missing, not enough information, or not applicable (When-relevant facts only), with what the pages give, what's
   missing, the smallest fix, and quotes. A positive finding needs a quote found word for word on the page it names,
   else it shows as *couldn't verify*.
3. `cc_answer_chatgpt` / `_claude` / `_gemini`: **each AI answers the fact questions from the website pages only**,
   with every tool off (no web search, no page reading), told to answer "NOT STATED" when the pages don't say.
4. `cc_score` (one Claude Haiku call): "NOT STATED" is judged in plain code (right when our assessment says the
   website doesn't give the fact, else *didn't answer*); every other answer is judged against the same pages:
   complete and accurate, detail missing, wrong, or not on your website.
5. `ws_section` builds the **Clear & complete slide**: the verdict and counts from the stored statuses, one row per
   applicable fact (our website assessment, then ChatGPT, Claude, Gemini), and the fixes (core facts first).

What it is and isn't: a test of what the pages say, answered by the providers' API models with the pages handed to
them. It doesn't show whether an AI finds or reads the pages on its own (that is Find & read), and an AI's mistake
despite clear pages isn't counted as a website gap.

## Part 4c: Distinctive

What does the website tell AI about why someone should choose the business? **Costs about $0.10 per report** (mostly
Claude's answer), within the spending cap. Runs on its own after `cc_bundle` (same pages as Clear & complete).

1. `ds_answer_chatgpt` / `_claude` / `_gemini`: each AI, given only the website pages with every tool off, writes a
   one-sentence description and answers five neutral questions (docs/engineering/distinctive-relevant.md): what the
   business offers, who it's best for, why someone would choose it, when another business of its kind would be better,
   and its limits. Nothing about the expected answers is in the prompt; "NOT STATED" when the pages don't say.
2. `ds_score` (one Claude Haiku call): the specific reasons to choose the business that the pages support (kept only
   when a quote is found word for word on its page; generic claims don't count), which AIs mention each one, and a flag
   per answer: generic, not on your website (with the claim), or fine. "NOT STATED" is handled in plain code. Up to
   three suggestions for the pages, never invented claims.
3. `ws_section` builds the **Distinctive slide**: each AI's description and answers with their flags; takeaways
   computed in plain code (reasons all AIs pick up, reasons only some find, supported reasons no AI repeats, answers
   that add things the site doesn't say, and when no AI can say what sets the business apart); the suggestions.

A competitive advantage is never claimed from the website alone: comparing with named competitors needs their
evidence, which is a later part. One answer per AI per question, recorded as a single snapshot.

Scorer instructions v2 (18 Nov 2026, after the first MVP Miami run): both scorers (`content/score-answers`,
`content/assess-distinctive`) count an answer that says the same as the pages in other words as supported, must search
all pages before flagging, and name only the specific detail that isn't on the pages. Rerun `cc_score` and `ds_score`
(no new AI answers needed) to apply it to an existing report.
