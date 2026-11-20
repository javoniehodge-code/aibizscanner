# Milestone 4 setup: web presence

Milestone 4 fills the report's web presence slides (Citation coverage, Credible & corroborated, the web presence map,
Consistent & current). This page grows as each part lands.

## Owner decisions (19 Nov 2026)

- **Cited pages:** we fetch at most **20** of the outside pages AI cited per report, the most-cited first. With service
  lines saved, **20 per shown line** (decision of 19 Nov 2026, below).
- **Google Places:** approved, **with reviews**. Key `GOOGLE_PLACES_API_KEY` in Vercel (type Secret; never
  `NEXT_PUBLIC_`), restricted to Places API (New), with daily quotas of 100 for SearchTextRequest and GetPlaceRequest.
- **Google storage (19 Nov 2026):** "store as long as we can". Within Google's terms that means: the **place ID**
  indefinitely (refreshed after 12 months, free); **latitude/longitude** up to 30 days; everything else (hours, phone,
  address, rating, reviews) **fetched when shown, not stored** (Places API policies). Google content is not sent to
  AI models; comparisons with the website are plain code. A stored window for other content would exceed the terms
  and needs an explicit owner decision first (build guide §12).
- **Yelp:** left out for now (no free tier, and its terms limit caching and use with AI models). A Yelp page that AI
  cites is handled like any other cited page: its robots.txt asks checkers like ours not to fetch it, so it shows as
  "couldn't check", never as missing.

## Part 4a-1: the outside pages AI cited (stage 8, collection)

Nothing to configure: no new keys, vendors or costs.

Stages: `wp_pages` (check the cited outside pages), then `wp_section` (build the report parts), then `report_assemble`.
Run `wp_pages` from the run monitor once the prompt analysis has finished; the other two follow automatically.

What it does:

1. **Ranks** the cited pages that aren't a company's own website (maps, reviews, directories, editorial, communities,
   official, unclassified) by the distinct prompts that cited them; ties by answers, then page key. A page counts once
   per prompt however many AIs cited it.
2. **Follows each site's robots.txt** for our own checker (`AIBizScannerBot`). A page it disallows isn't fetched.
3. **Reads the page:** a plain fetch first; if that is refused or has fewer than 150 words, our headless browser (or an
   earlier browser copy from this report). Browser loads start within a 200-second budget; pages not reached are
   marked "not reached in time" and a rerun picks them up. Every copy is stored as a page snapshot. We read the whole
   page body (without navigation, header, footer and forms), since listings can name businesses outside the main area.
   When different pages of one site give us exactly the same text, we got a shared shell (a consent, block or loading
   page), so those pages count as unread.
4. **Finds business names** in plain code: the target (with its aliases) and every business the prompt analysis names.
   Multi-word names match in any letter case; a one-word name must be written with its capitals ("Turo", not "turo").
5. **Citation coverage:** one row per website with a page we read, ticking each business its pages name, with a scope
   line saying how many pages were read and why the rest weren't. A site we couldn't read is left out, never shown as
   a row of blanks.

What it isn't: a check of a whole website (only the exact pages AI cited), or proof that a page influenced an answer.

## Part 4a-2: how each cited page presents the business (stage 8, interpretation)

Stages: `wp_pages`, then `wp_assess` (one reading per page we read), then `wp_section` builds Citation coverage,
Credible & corroborated and the web presence map. `wp_assess` runs on its own after `wp_pages`; no keys to add.

- **Who reads:** Claude Sonnet (the scoring model), instruction `web-presence/assess-page` v1. Each page is cut to
  3,000 words. About $0.02 a page, so $0.15–0.30 a report at 20 pages.
- **Plain code decides what counts:** a reason, concern, rating or column mark stands only with a quote found on the
  page (at least four words; two for a rating). Our name check has the last word on whether the business is on the
  page: the model can't put it on a page where we didn't find its name, or take it off one where we did. A
  "recommended" without a quoted reason becomes "named". Every change is kept on the reading as `overruled`.
- **Credible & corroborated:** every count, summary sentence and fix is plain code. The bars count usable answers;
  answers citing only pages we couldn't read are left out, never counted as absent. Pages we couldn't read show as
  "Couldn't check". "What customers say" appears only when a page shows a rating of the business (Google reviews join
  in part 4b).
- **Web presence map:** one row per website among the selected pages; a site with no page we could read shows
  "Couldn't check" in every column.
- **Not yet:** "Conflict" in the map (needs the website baseline, part 4c) and separately checked profiles (4b).

## Part 4b-1: find and confirm the Google listing (stage 1, identity check)

On a business's edit page, **Find on Google** searches Places API (New) Text Search for "name, location" and shows
up to five listings (name, type, address, a Google Maps link). **This is the business** stores its place ID and the
date; **Clear** removes it. The search results are shown, not stored. Fields asked for (billed by field, Text Search
Pro): id, display name, formatted address, primary type, Google Maps link. A search is needed once per business, and
again after a year to refresh the ID.

## Part 4b-2: Google in the report, read live

When a pipeline report with a Credible part is opened (`/reports/[id]/document`), and its business has a confirmed
listing, the server reads Google's listing (Place Details, Enterprise + Atmosphere for reviews) and adds it to that
response only. The stored report document is unchanged; nothing from Google is stored.

- **What customers say:** a Google card first: rating out of 5, review count, the reviews Google shows with each
  author's name and profile link, "Read on Google" links, and "Source: Google Maps" linking to the listing. Google's
  reviews are shown as Google gives them; no AI summary.
- **Web presence map:** a "Google Business Profile" row (additional source): business details P/L/N by whether phone,
  address and hours are shown; services "couldn't check" (not read from Google yet); customer fit and recommendations
  not applicable; reviews and locations from the listing. If Google can't be read, every cell is "Couldn't check".
- **Cost:** one call each time the report is opened. $0.025 a call after 1,000 free a month; the 100-a-day quota caps it.
  These calls aren't recorded in a report's spend (they happen when viewing, not in a stage run).
- Example reports (fixtures) are shown as they are.

## Service lines: one citation map per line (19 Nov 2026)

Owner decisions: a business with very different services (MVP Miami: car rental, villas, yachts) is treated almost as
separate businesses, because each service has its own cited sites and competitors.

- **Lines:** on the prompts page, *Service lines* takes one line per service, `Name | P1, P2, P5`. A question can be in
  several lines (MVP Miami's car + villa + yacht package question counts in all three). Saving queues `pa_lines`; no
  question is asked again. `pa_lines` reads no other stage, so approving a new prompt set doesn't hold anything up; ids
  not in the current set are ignored.
- **Shown lines:** a line with fewer than **3** questions gets no map (hidden until the question set grows).
- **Pages:** `wp_pages` reruns on its own after a save. Each shown line reads up to **20** of its cited outside
  pages, most-cited first, ranked by that line's questions (a page chosen for two lines is read once). About $0.40 to
  read a line's pages in `wp_assess`. Without saved lines: the 20 most-cited pages of the whole report.
- **Sites that refuse us are passed over (20 Nov 2026):** once a site refuses our checker (HTTP 401, 403 or 429), its
  other pages aren't fetched this run ("refused our checker on another page") and the next most-cited pages are read
  instead, so a line gets up to 20 pages we could read. Pages robots.txt asks us not to fetch, or that are missing,
  don't count towards the 20 either. A line tries at most 40 pages. In MVP Miami's first per-line run, 10 of the 20
  places went to pages we couldn't read (5 on turo.com).
- **Competitors' own websites:** a cited page whose site name is a business's name written together is that
  business's own website, not an outside site (exoticmiamirental.com for Exotic Miami Car Rental; one word may be left
  out of a 3+ word name; "Co." and similar may be written or not). Unclassified pages like this are left out unread.
  Directory pages like this (20 Nov 2026; partyfunrental.com for Party Fun Rental) are read first and kept as an
  outside site only if they name at least two other businesses, since some marketplaces share a name with a business
  AI names (giggster.com). A company site named unlike any business AI named (miamiexoticcarrental.com) can't be told
  apart this way; it shows among the sites that named none of the top 15.
- **Map per line (`wp_section`):** columns are the business and the line's **top 15** competitors, ranked by the number
  of the line's usable answers naming them (as on the Businesses named slide), ties by name. Rows are the websites of
  pages we read that the line's answers cite and that name at least one of those businesses. Sites naming only other
  businesses or none (AI cited them for facts such as prices), and pages we couldn't read, are counted in the scope line
  instead of shown as rows of blanks.
- **Slides:** one *Citation coverage* slide per line, labelled with the line. The business and competitors 1–7 are the
  first table; competitors 8–15 a second table below against the same sites. The cited-pages table stays on the first
  coverage slide. Example reports (one map) are unchanged.
- **Not yet split by line:** Credible & corroborated, the web presence map and the competitor slides still use every
  question and page.

Why the rows changed: in MVP Miami's report, 6 of the 10 rows were blank. Three sites named only businesses that didn't
make the 7 columns (ranked 57th–72nd of 99), one was a competitor's own site, and three named no business at all. A
follow-up test (19 Nov 2026, ChatGPT only; P1, P2, P4 asked again, then "which sites helped you pick companies, not
learn facts?") found ChatGPT picks mostly from companies' own websites and cites what it used: one helpful site in
three questions wasn't cited (kayak.com, a rating cross-check), out of 23–33 sites its searches returned.

## Part 4c-1: Consistent & current, website vs cited pages (20 Nov 2026)

Owner decisions (20 Nov 2026): a fact either **agrees** or **doesn't agree**; nothing about "current". Facts no other
source mentions, or the website doesn't give, have no status and are listed under the table as "Not mentioned by other
sources". About $0.15 more per report for the extra Sonnet reading is approved.

- **Which facts:** the standard's facts that can be compared as values (`content/values.ts`, `COMPARABLE`). Car rental:
  vehicles (list), prices (price per vehicle and unit of time), minimum age (number), deposit (money), address,
  phone, chauffeur (yes/no), cancellation notice in hours (number), other services (list).
- **Website values (`cc_values`, new):** one Sonnet call over the website pages Clear & complete already uses
  (instruction `content/website-values` v1). Runs on its own after `cc_bundle`.
- **Cited-page values (`wp_assess`, instruction `web-presence/assess-page` v2):** the same page reading also lists the
  business's values, only on pages our name check found the business on. No extra call.
- **Plain code keeps a value** only when its quote (at least three words) is on the page and the value is in the quote:
  the phone's digits, the amount, the vehicle or item. Dropped values are kept for review (`dropped`, `overruled`).
- **Plain code compares, like for like:** phone numbers by their last ten digits; addresses by street line
  (abbreviations unified, suite dropped); numbers and money by amount; prices only for the same vehicle (two or more
  matching words) and the same unit of time; lists item by item; yes/no exactly. A fact disagrees when any source
  differs, agrees when at least one agrees and none differs. A page we couldn't read is never a disagreement.
- **Slide:** one column per outside site giving values (up to 6), the two counts, the "Not mentioned by other sources"
  list and one fix per disagreeing site and fact. Example reports keep the approved four-state design.
- **Not yet (4c-2):** Google's listing as a column, compared when the report is opened (never stored), and "Conflict"
  marks in the web presence map.

After deploying: run `cc_values` once in the run monitor (it runs on its own after later `cc_bundle` runs), then rerun
`wp_assess` so the page readings include values; `wp_section` and `report_assemble` follow.

## Part 4c-2: Google's listing on Consistent & current, and Conflict in the map (20 Nov 2026)

- **Stored:** `website.consistent.liveCompare` holds the website's own phone numbers and address as written. Nothing
  from Google is stored. A Consistent & current part is now kept even with no outside site giving values, when the
  website gives a phone or address (Google can be compared); otherwise the slide is left out as before.
- **When the report is opened** (`report/google-live.ts`, the same Place Details call as the review card): Google's
  phone and address are compared with the website's in plain code (the same rules as the stored part). The slide gets a
  "Google Business Profile" column; a fact only Google gives moves from "Not mentioned by other sources" into the
  table; statuses, the verdict and the fixes are recomputed; Google's row in the web presence map shows "Conflict"
  where its phone or address differs. If Google can't be read, its column says so and no status changes.
- **Conflict in the web presence map (stored):** an outside site whose value doesn't agree with the website gets
  "Conflict" in the fact's column (contact and terms under Business details, vehicles and prices under Services, the
  address under Locations).
