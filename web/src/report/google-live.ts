import type { PlaceDetails } from "@/lib/google/places";

/**
 * Google's listing in a report, added when the report is shown and never stored (Places API policies; owner decision
 * 19 Nov 2026). The stored report document stays as the pipeline built it; this returns a copy for one response.
 * Plain code only: Google content is shown as Google gives it and not sent to any AI model.
 */
export const GOOGLE_LIVE_EVIDENCE = "google-live";
const ATTRIBUTION = "Google Maps";

type Doc = Record<string, unknown> & {
  evidence: Record<string, unknown>;
  credible: null | ({ reviews: unknown[] } & Record<string, unknown>);
  webPresence: null | unknown[];
};

const observed = <T>(v: T) => ({ v, p: { kind: "observed" as const, evidence: [GOOGLE_LIVE_EVIDENCE] } });
const bare = (url: string | null) => (url ?? "").replace(/^https?:\/\//i, "").replace(/^www\./, "");
const n = (x: number) => x.toLocaleString("en-US");

/** The Google review card for "What customers say". Null when the listing shows no rating. */
export function googleReviewCard(p: PlaceDetails) {
  if (p.rating === null) return null;
  const latest = p.reviews.find((r) => r.when)?.when ?? null;
  return {
    label: "Google",
    title: p.name ?? "Google Business Profile",
    rating: p.rating.toFixed(1),
    count: p.ratingCount !== null ? n(p.ratingCount) : null,
    recent: latest ? `Latest review shown: ${latest}` : "Google shows no review dates",
    themes: p.reviews.length ? `The ${p.reviews.length} reviews Google shows, as Google shows them:` : "Google shows no review text.",
    cited: false,
    scale: 5,
    items: p.reviews.map((r) => ({ author: r.author, authorUrl: r.authorUrl, rating: r.rating, when: r.when, text: r.text, url: r.url })),
    attribution: { text: ATTRIBUTION, url: p.mapsUrl },
  };
}

type Mark = "P" | "L" | "N" | "A" | "U";

/** The Google row of the web presence map (an additional source: we looked it up, AI didn't cite it). */
export function googlePresenceRow(p: PlaceDetails | null, error: string | null) {
  const url = bare(p?.mapsUrl ?? null) || "google.com/maps";
  if (!p) {
    const says = `We couldn't load the Google listing just now (${error ?? "no response"}). Reload the report to try again.`;
    return {
      name: "Google Business Profile",
      domain: "google.com",
      type: "Maps & places",
      pageKeys: [],
      pagesChecked: 0,
      pagesFailed: 1,
      marks: ["U", "U", "U", "U", "U", "U"] as [Mark, Mark, Mark, Mark, Mark, Mark],
      details: { "0": { says, excerpt: "", url, issue: "", action: "" } },
    };
  }
  const have = [p.phone, p.address, p.hours.length ? "hours" : null].filter(Boolean).length;
  const details: Mark = have === 3 ? "P" : have ? "L" : "N";
  const reviews: Mark = p.rating !== null && (p.ratingCount ?? 0) > 0 ? "P" : "N";
  const locations: Mark = p.address ? "P" : "N";
  const missing = [!p.phone && "phone", !p.address && "address", !p.hours.length && "opening hours"].filter(Boolean) as string[];
  return {
    name: "Google Business Profile",
    domain: "google.com",
    type: "Maps & places",
    pageKeys: [],
    pagesChecked: 1,
    pagesFailed: 0,
    // Business details, Services, Customer fit, Reviews, Recommendations, Locations.
    marks: [details, "U", "A", reviews, "A", locations] as [Mark, Mark, Mark, Mark, Mark, Mark],
    details: {
      "0": {
        says: `Google lists ${[p.phone && `the phone ${p.phone}`, p.address && `the address ${p.address}`, p.hours.length && "opening hours for each day"].filter(Boolean).join(", ") || "no contact details"}.${p.status && p.status !== "OPERATIONAL" ? ` Google marks the business as ${p.status.toLowerCase().replace(/_/g, " ")}.` : ""}`,
        excerpt: p.hours.slice(0, 2).join(" · "),
        url,
        issue: missing.length ? `Google doesn't show your ${missing.join(" or ")}.` : "",
        action: missing.length ? "Add them in your Google Business Profile." : "",
      },
      "1": { says: "We don't read services from Google listings yet.", excerpt: "", url, issue: "", action: "" },
      ...(reviews === "P" ? { "3": { says: `Rated ${p.rating!.toFixed(1)} out of 5 from ${n(p.ratingCount!)} Google reviews.`, excerpt: "", url, issue: "", action: "" } } : {}),
      ...(locations === "P" ? { "5": { says: `Listed at ${p.address}.`, excerpt: "", url, issue: "", action: "" } } : {}),
    },
  };
}

/**
 * The report with Google added, for this response only. Only reports with a Credible part get the review card and
 * the map row (those slides are where Google appears).
 */
export function withGoogle(doc: Doc, live: { details: PlaceDetails | null; error: string | null }, today: string): Doc {
  if (!doc.credible || !doc.webPresence) return doc;
  const card = live.details ? googleReviewCard(live.details) : null;
  return {
    ...doc,
    evidence: { ...doc.evidence, [GOOGLE_LIVE_EVIDENCE]: { source: "Google Places listing, read when this report was opened (not stored)", ref: `place ${live.details?.id ?? "unavailable"}`, capturedOn: today } },
    credible: { ...doc.credible, reviews: [...(card ? [observed(card)] : []), ...doc.credible.reviews.filter((r) => (r as { v?: { label?: string } }).v?.label !== "Google")] },
    webPresence: [...doc.webPresence.filter((w) => (w as { v?: { domain?: string } }).v?.domain !== "google.com" || ((w as { v: { pageKeys: string[] } }).v.pageKeys.length > 0)), observed(googlePresenceRow(live.details, live.error))],
  };
}
