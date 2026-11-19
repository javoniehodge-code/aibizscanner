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
