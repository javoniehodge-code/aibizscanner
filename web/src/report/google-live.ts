import type { PlaceDetails } from "@/lib/google/places";
import type { CheckedValue } from "@/engine/modules/content/values";
import { compareFact, fixOf, meansOf, sitesPhrase, verdictOf, type Cell } from "@/engine/modules/web-presence/logic/consistent";

/**
 * Google's listing in a report, added when the report is shown and never stored (Places API policies; owner decision
 * 19 Nov 2026). The stored report document stays as the pipeline built it; this returns a copy for one response.
 * Plain code only: Google content is shown as Google gives it and not sent to any AI model.
 */
export const GOOGLE_LIVE_EVIDENCE = "google-live";
const ATTRIBUTION = "Google Maps";

type Env<T> = { v: T; p: unknown };
type FactRow = { name: string; website: { value: string; pages: string | null; issue: string | null }; sources: { text: string; mark: "g" | "r" | "n" }[]; status: string; means: string; note: string | null };
export type ConsistentPart = Record<string, unknown> & {
  verdict: Env<{ heading: string; text: string }>;
  sources: Env<{ name: string; sub: string }>[];
  facts: Env<FactRow>[];
  notMentioned?: Env<{ name: string; website: string | null; note: string }>[];
  liveCompare?: Env<{ name: string; kind: "phone" | "address"; website: string[] }>[];
  fixes: Env<{ title: string; where: string; why: string }>[];
  rules: Env<{ k: string; v: string }>[];
};
type Doc = Record<string, unknown> & {
  evidence: Record<string, unknown>;
  credible: null | ({ reviews: unknown[] } & Record<string, unknown>);
  webPresence: null | unknown[];
  website?: null | (Record<string, unknown> & { consistent?: ConsistentPart | null });
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

type Mark = "P" | "L" | "N" | "A" | "U" | "C";

const asValue = (value: string): CheckedValue => ({ fact: "", ref: null, value, amount: null, unit: null, item: null, quote: value });
/** Google's phone and address against the website's, in plain code. Facts Google doesn't list have nothing to compare. */
function googleCells(c: ConsistentPart, p: PlaceDetails | null) {
  return (name: string): Cell => {
    const lc = c.liveCompare?.find((x) => x.v.name === name)?.v;
    if (!lc) return { mark: "n", text: "Not mentioned", differs: [] };
    if (!p) return { mark: "n", text: "Couldn't load the listing", differs: [] };
    const g = lc.kind === "phone" ? p.phone : p.address;
    if (!g) return { mark: "n", text: "Not on the listing", differs: [] };
    return compareFact(lc.kind, lc.website.map(asValue), [asValue(g)]);
  };
}

/**
 * Consistent & current with Google's listing as one more source column (part 4c-2), for this response only. Pipeline
 * reports only (those with notMentioned and liveCompare); statuses, counts, the verdict and fixes are recomputed in
 * plain code with the same rules as the stored part.
 */
export function googleConsistent(c: ConsistentPart, p: PlaceDetails | null): { part: ConsistentPart; differs: { phone: string | null; address: string | null } } {
  const differs = { phone: null as string | null, address: null as string | null };
  if (!c.notMentioned || !c.liveCompare) return { part: c, differs };
  const cellOf = googleCells(c, p);
  const kindOf = (name: string) => c.liveCompare!.find((x) => x.v.name === name)?.v.kind;
  const ob = observed;
  const googleFixes: ReturnType<typeof fixOf>[] = [];
  const row = (r: FactRow, cell: Cell): FactRow => {
    const sources = [...r.sources, { text: cell.text, mark: cell.mark }];
    const status = sources.some((x) => x.mark === "r") ? "c" : "a";
    if (cell.mark === "r") {
      const k = kindOf(r.name);
      if (k) differs[k] = cell.text;
      googleFixes.push(fixOf(r.name, "your Google Business Profile", cell.text, r.website.value));
    }
    const note = cell.mark === "r" ? `${r.note ? `${r.note} ` : ""}Google's listing says ${cell.text}; your website says ${r.website.value}.` : r.note;
    return { ...r, sources, status, means: meansOf(status as "a" | "c", sources.filter((x) => x.mark === "g").length, r.name), note };
  };
  const facts = c.facts.map((f) => ({ ...f, v: row(f.v, cellOf(f.v.name)) }));
  // A fact no other source gave becomes comparable when Google's listing gives it.
  const notMentioned: NonNullable<ConsistentPart["notMentioned"]> = [];
  for (const m of c.notMentioned) {
    const cell = cellOf(m.v.name);
    if (m.v.website && (cell.mark === "g" || cell.mark === "r")) {
      facts.push(ob(row({ name: m.v.name, website: { value: m.v.website, pages: null, issue: null }, sources: c.sources.map(() => ({ text: "Not mentioned", mark: "n" as const })), status: "a", means: "", note: null }, cell)) as Env<FactRow>);
    } else notMentioned.push(m);
  }
  const differ = facts.filter((f) => f.v.status === "c").length;
  const against = c.sources.length ? `${sitesPhrase(c.sources.length)} and your Google Business Profile` : "your Google Business Profile";
  return {
    part: {
      ...c,
      verdict: ob(verdictOf(facts.length, differ, against)),
      sources: [...c.sources, ob({ name: "Google Business Profile", sub: "Maps & places · read when you opened this report" })],
      facts,
      notMentioned,
      fixes: [...googleFixes.map(ob), ...c.fixes],
      rules: [...c.rules, ob({ k: "Google Business Profile", v: "Read when you open this report and never stored. Its phone number and address are compared with your website's in plain code; nothing from Google is sent to an AI model." })],
    },
    differs,
  };
}

/** The Google row of the web presence map (an additional source: we looked it up, AI didn't cite it). */
export function googlePresenceRow(p: PlaceDetails | null, error: string | null, differs: { phone: string | null; address: string | null } = { phone: null, address: null }) {
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
    // "Conflict" where Google's phone or address doesn't agree with the website (Consistent & current).
    marks: [differs.phone ? "C" : details, "U", "A", reviews, "A", differs.address ? "C" : locations] as [Mark, Mark, Mark, Mark, Mark, Mark],
    details: {
      "0": differs.phone ? { says: `Google's phone (${differs.phone}) differs from your website's.`, excerpt: "", url, issue: "Different from your website.", action: "Correct it in your Google Business Profile, or correct your website first if it's out of date." } : {
        says: `Google lists ${[p.phone && `the phone ${p.phone}`, p.address && `the address ${p.address}`, p.hours.length && "opening hours for each day"].filter(Boolean).join(", ") || "no contact details"}.${p.status && p.status !== "OPERATIONAL" ? ` Google marks the business as ${p.status.toLowerCase().replace(/_/g, " ")}.` : ""}`,
        excerpt: p.hours.slice(0, 2).join(" · "),
        url,
        issue: missing.length ? `Google doesn't show your ${missing.join(" or ")}.` : "",
        action: missing.length ? "Add them in your Google Business Profile." : "",
      },
      "1": { says: "We don't read services from Google listings yet.", excerpt: "", url, issue: "", action: "" },
      ...(reviews === "P" ? { "3": { says: `Rated ${p.rating!.toFixed(1)} out of 5 from ${n(p.ratingCount!)} Google reviews.`, excerpt: "", url, issue: "", action: "" } } : {}),
      ...(differs.address
        ? { "5": { says: `Google's address (${differs.address}) differs from your website's.`, excerpt: "", url, issue: "Different from your website.", action: "Correct it in your Google Business Profile, or correct your website first if it's out of date." } }
        : locations === "P"
          ? { "5": { says: `Listed at ${p.address}.`, excerpt: "", url, issue: "", action: "" } }
          : {}),
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
  const consistent = doc.website?.consistent ? googleConsistent(doc.website.consistent, live.details) : null;
  return {
    ...doc,
    ...(consistent && doc.website ? { website: { ...doc.website, consistent: consistent.part } } : {}),
    evidence: { ...doc.evidence, [GOOGLE_LIVE_EVIDENCE]: { source: "Google Places listing, read when this report was opened (not stored)", ref: `place ${live.details?.id ?? "unavailable"}`, capturedOn: today } },
    credible: { ...doc.credible, reviews: [...(card ? [observed(card)] : []), ...doc.credible.reviews.filter((r) => (r as { v?: { label?: string } }).v?.label !== "Google")] },
    webPresence: [...doc.webPresence.filter((w) => (w as { v?: { domain?: string } }).v?.domain !== "google.com" || ((w as { v: { pageKeys: string[] } }).v.pageKeys.length > 0)), observed(googlePresenceRow(live.details, live.error, consistent?.differs))],
  };
}
