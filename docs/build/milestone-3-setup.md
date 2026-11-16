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
