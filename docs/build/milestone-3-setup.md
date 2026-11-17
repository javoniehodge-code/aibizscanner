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
