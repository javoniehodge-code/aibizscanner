import { describe, expect, it } from "vitest";
import type { PlaceDetails } from "@/lib/google/places";
import { FIXTURES } from "./generated/fixtures";
import { googlePresenceRow, withGoogle } from "./google-live";
import { reportDocument } from "./schema";

const PLACE: PlaceDetails = {
  id: "ChIJ19s3fbi72YgR0SQuauvlGg0",
  name: "MVP Miami",
  address: "2500 NW 39th St, Miami, FL 33142, USA",
  phone: "(786) 877-4317",
  website: "https://www.mvpmiami.com/",
  hours: ["Monday: 9:30 AM – 9:30 PM", "Tuesday: 9:30 AM – 9:30 PM"],
  status: "OPERATIONAL",
  rating: 4.9,
  ratingCount: 412,
  mapsUrl: "https://maps.google.com/?cid=9",
  reviews: [{ author: "Ana R.", authorUrl: "https://www.google.com/maps/contrib/1", rating: 5, when: "2 weeks ago", publishedAt: null, text: "Great cars and service.", url: null }],
};
const doc = () => structuredClone(FIXTURES["mvp-miami"]) as Parameters<typeof withGoogle>[0];

describe("Google in the report, for one response", () => {
  it("adds a review card with each review's author and the attribution, and a Google row; the report stays valid", () => {
    const before = doc();
    const out = withGoogle(before, { details: PLACE, error: null }, "2026-11-19");
    const parsed = reportDocument.safeParse(out);
    expect(parsed.success, JSON.stringify(parsed.error?.issues.slice(0, 3))).toBe(true);
    const card = parsed.data!.credible!.reviews[0]!.v;
    expect(card).toMatchObject({ label: "Google", rating: "4.9", count: "412", scale: 5, cited: false, attribution: { text: "Google Maps", url: "https://maps.google.com/?cid=9" } });
    expect(card.items).toEqual([{ author: "Ana R.", authorUrl: "https://www.google.com/maps/contrib/1", rating: 5, when: "2 weeks ago", text: "Great cars and service.", url: null }]);
    const row = parsed.data!.webPresence!.at(-1)!.v;
    expect(row).toMatchObject({ name: "Google Business Profile", pageKeys: [], pagesChecked: 1, marks: ["P", "U", "A", "P", "A", "P"] });
    expect(parsed.data!.evidence["google-live"]).toMatchObject({ capturedOn: "2026-11-19" });
    // The stored document isn't changed.
    expect(before.credible!.reviews.some((r) => (r as { v: { label: string } }).v.label === "Google")).toBe(false);
  });

  it("says when Google couldn't be read, and marks what's missing from the listing", () => {
    expect(googlePresenceRow(null, "HTTP 403").marks).toEqual(["U", "U", "U", "U", "U", "U"]);
    const row = googlePresenceRow({ ...PLACE, phone: null, hours: [] }, null);
    expect(row.marks[0]).toBe("L");
    expect(row.details["0"]).toMatchObject({ issue: "Google doesn't show your phone or opening hours.", action: "Add them in your Google Business Profile." });
    const out = withGoogle(doc(), { details: null, error: "HTTP 403" }, "2026-11-19");
    expect(reportDocument.safeParse(out).success).toBe(true);
  });
});

describe("Google's listing on the Consistent & current slide (part 4c-2), for one response", () => {
  const obs = <T>(v: T) => ({ v, p: { kind: "observed", evidence: ["website-values"] } });
  // What wp_section stores for MVP Miami: one outside site, phone and address kept for the live comparison.
  const stored = () => ({
    intro: obs("We compare the facts on your website with what the outside pages AI cited say about you."),
    verdict: obs({ heading: "The one fact we could compare agrees", text: "x" }),
    sources: [obs({ name: "respectmyregion.com", sub: "Editorial & publication" })],
    facts: [obs({ name: "How to book and contact", website: { value: "786.877.4317", pages: "Home page", issue: null }, sources: [{ text: "786-877-4317", mark: "g" as const }], status: "a", means: "1 other source says the same as your website, so AI finds one consistent answer.", note: null })],
    notMentioned: [
      obs({ name: "Delivery, pickup and areas served", website: "2500 NW 39th Street, Miami, Florida 33142", note: "No other source we read gives this." }),
      obs({ name: "Vehicles available", website: "Ferrari 488 Spider", note: "No other source we read gives this." }),
    ],
    liveCompare: [obs({ name: "How to book and contact", kind: "phone" as const, website: ["786.877.4317"] }), obs({ name: "Delivery, pickup and areas served", kind: "address" as const, website: ["2500 NW 39th Street, Miami, Florida 33142"] })],
    fixes: [],
    rules: [obs({ k: "Agree", v: "x" })],
  });
  const withConsistent = () => {
    const d = doc();
    (d.website as { consistent: unknown }).consistent = stored();
    d.evidence["website-values"] = { source: "Our reading of your website's facts", ref: "stage_run cv", capturedOn: "2026-11-20" };
    return d;
  };

  it("adds a Google column; a fact only Google gives becomes comparable; counts and verdict follow", () => {
    const out = withGoogle(withConsistent(), { details: PLACE, error: null }, "2026-11-20");
    const parsed = reportDocument.safeParse(out);
    expect(parsed.success, JSON.stringify(parsed.error?.issues.slice(0, 3))).toBe(true);
    const c = parsed.data!.website!.consistent!;
    expect(c.sources.map((s) => s.v.name)).toEqual(["respectmyregion.com", "Google Business Profile"]);
    expect(c.facts.map((f) => [f.v.name, f.v.status, f.v.sources.map((s) => s.mark)])).toEqual([
      ["How to book and contact", "a", ["g", "g"]],
      ["Delivery, pickup and areas served", "a", ["n", "g"]],
    ]);
    expect(c.facts[0]!.v.means).toBe("2 other sources say the same as your website, so AI finds one consistent answer.");
    expect(c.notMentioned!.map((m) => m.v.name)).toEqual(["Vehicles available"]);
    expect(c.verdict.v.heading).toBe("Both facts we could compare agree");
    expect(c.verdict.v.text).toContain("1 outside site AI cited that name you and your Google Business Profile");
    expect(parsed.data!.webPresence!.at(-1)!.v.marks).toEqual(["P", "U", "A", "P", "A", "P"]);
  });

  it("a different phone on Google doesn't agree: a fix, a note, and Conflict in the map", () => {
    const out = withGoogle(withConsistent(), { details: { ...PLACE, phone: "(305) 555-0100" }, error: null }, "2026-11-20");
    const c = reportDocument.parse(out).website!.consistent!;
    expect(c.facts[0]!.v).toMatchObject({ status: "c", note: "Google's listing says (305) 555-0100; your website says 786.877.4317." });
    expect(c.fixes[0]!.v.title).toBe("Correct the how to book and contact on your Google Business Profile");
    expect(c.verdict.v.heading).toBe("1 of 2 facts we could compare doesn't agree");
    const row = reportDocument.parse(out).webPresence!.at(-1)!.v;
    expect(row.marks[0]).toBe("C");
    expect(row.details["0"]!.says).toBe("Google's phone ((305) 555-0100) differs from your website's.");
  });

  it("when Google can't be read, its column says so and nothing changes status", () => {
    const c = reportDocument.parse(withGoogle(withConsistent(), { details: null, error: "HTTP 403" }, "2026-11-20")).website!.consistent!;
    expect(c.facts.map((f) => [f.v.status, f.v.sources.at(-1)])).toEqual([["a", { text: "Couldn't load the listing", mark: "n" }]]);
    expect(c.notMentioned).toHaveLength(2);
  });

  it("leaves example reports' slide as it is", () => {
    const before = doc();
    const out = withGoogle(before, { details: PLACE, error: null }, "2026-11-20");
    expect((out.website as { consistent: unknown }).consistent).toEqual((before.website as { consistent: unknown }).consistent);
  });
});
