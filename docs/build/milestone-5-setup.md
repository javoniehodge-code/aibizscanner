# Milestone 5 setup: competitors and the To Do list

Milestone 5 fills the Competitor comparison slide (stage 10) and the To Do list (stage 11). This page grows as each
part lands.

## Owner decisions (20 Nov 2026)

- **Who is compared:** the two businesses AI recommends most in the main service line (the shown line with the most
  questions; every question without lines), ties by answers naming them, then by name. An admin can choose the two
  instead on the prompts page ("Competitors to compare"); leaving it empty goes back to the automatic choice.
- **Their facts:** only the pages AI cited from each competitor's own website, plus its home page. No crawl of their
  sites. robots.txt is followed, as for every page we fetch.
- **Google for competitors (part 5b):** their rating, review count, phone and address, read live when the report is
  opened and never stored. One Text Search per competitor to find its listing (only the place ID is stored), then two
  Place Details calls per report view, within the 100-a-day quotas.
- **Marks:** no "better or worse" judgments. A fact a business doesn't publish while another does is marked (it
  trails on that point); the template highlights the most recommended business.
- **Budget:** MVP Miami's report cap raised to $15 for testing.

## Part 5a: the comparison (stage 10)

Stages (module `competitors`), each runs on its own after the one before:

1. `cp_choice` (optional): the admin's two names, saved from the prompts page.
2. `cp_pages`: picks the two competitors and reads their own pages AI cited (most cited first, up to 6 with the home
   page). A competitor's site is found by name among the cited "other business" and unclassified pages
   (mphclub.com for mph club; octane.rent for Octane Rent). A plain copy first; our browser when it's thin (180 s budget).
3. `cp_assess` (Sonnet, about $0.25 a report): each competitor's facts as values, with the same instruction and the
   same plain-code checks as the business's own website (`content/website-values`); and, for the business and both
   competitors, up to three reasons AI gives for choosing them and three concerns, from the line's answers that name
   them (instruction `competitors/answer-reasons` v1). An item is kept only when its quote is in the answer it names.
4. `cp_section` (plain code): one row per compared fact any of the three publishes, "Where AI finds them" from the
   line's citation coverage map, the reasons and concerns, a summary and three cards (your advantage, a disadvantage,
   what to do first). `report_assemble` reads it.

The "Recommended by AI" row counts only the compared line's answers (`competitors.questions`).

After deploying: the comparison runs on its own after the prompt analysis; for an existing report, run "Competitors
1/3" in the run monitor once.
