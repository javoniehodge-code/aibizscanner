import { ownSiteOf } from "../../web-presence/logic/pages";

/**
 * Competitor comparison (Milestone 5, stage 10), plain code. Owner decisions (20 Nov 2026): compare the business with
 * the two businesses AI recommends most in its main service line, ties by how often they're named, then by name; an
 * admin can choose the two instead. Their facts come only from the pages AI cited from their own websites plus their
 * home page (no crawl).
 */
export const COMPETITORS_VERSION = "2026-11-20";
/** Pages read per competitor: its own pages AI cited (most cited first), then its home page. */
export const MAX_PAGES_PER_COMPETITOR = 6;

export type Answers = {
  businesses: readonly { v: { key: string; name: string } }[];
  pages: readonly { v: { key: string; url: string; category: string; site?: string } }[];
  questions: readonly { question: { v: { id: string } }; answers: readonly { v: { status: string; named?: readonly { business: string; status: string }[]; citations?: readonly string[] } }[] }[];
};
export type Line = { name: string; questions: readonly string[] };

/** The main service line: the shown line with the most questions (first on a tie); null means every question. */
export const mainLine = (lines: readonly Line[] | null): Line | null => (lines?.length ? [...lines].sort((a, b) => b.questions.length - a.questions.length)[0]! : null);

export type Ranked = { key: string; name: string; recommended: number; named: number };
/** Businesses by answers recommending them in the line, then answers naming them, then name. */
export function rankBusinesses(pa: Answers, line: Line | null): { ranked: Ranked[]; answers: number } {
  const usable = pa.questions.filter((q) => !line || line.questions.includes(q.question.v.id)).flatMap((q) => q.answers.filter((a) => a.v.status === "ok"));
  const rec = new Map<string, number>();
  const named = new Map<string, number>();
  for (const a of usable) {
    const seen = new Set<string>();
    for (const n of a.v.named ?? []) {
      if (seen.has(n.business)) continue;
      seen.add(n.business);
      named.set(n.business, (named.get(n.business) ?? 0) + 1);
      if (n.status === "R") rec.set(n.business, (rec.get(n.business) ?? 0) + 1);
    }
  }
  const ranked = pa.businesses
    .map(({ v }) => ({ key: v.key, name: v.name, recommended: rec.get(v.key) ?? 0, named: named.get(v.key) ?? 0 }))
    .filter((b) => b.named > 0)
    .sort((a, b) => b.recommended - a.recommended || b.named - a.named || a.name.localeCompare(b.name));
  return { ranked, answers: usable.length };
}

const fold = (s: string) => s.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();

/**
 * The two competitors: the admin's choice when given (names matched ignoring case and punctuation), else the top two
 * other than the business. Throws with a plain message when a chosen name isn't among the businesses AI named.
 */
export function pickCompetitors(ranked: readonly Ranked[], all: Answers["businesses"], targetKey: string, chosen: readonly string[] | null): Ranked[] {
  if (chosen?.length) {
    return chosen.map((name) => {
      const b = all.find(({ v }) => v.key !== targetKey && fold(v.name) === fold(name))?.v;
      if (!b) throw new Error(`"${name}" isn't a business the AI answers named. Use a name as it appears on the Businesses named slide.`);
      return ranked.find((r) => r.key === b.key) ?? { key: b.key, name: b.name, recommended: 0, named: 0 };
    });
  }
  return ranked.filter((r) => r.key !== targetKey).slice(0, 2);
}

/**
 * A competitor's own website, from the pages AI cited that belong to another business's site and are named like it
 * (mphclub.com for mph club). Returns the site and its cited pages, most cited first, or null when none is found.
 */
export function competitorSite(pa: Answers, b: { key: string; name: string }): { site: string; urls: string[] } | null {
  const cites = new Map<string, number>();
  for (const q of pa.questions) for (const a of q.answers) for (const c of new Set(a.v.citations ?? [])) cites.set(c, (cites.get(c) ?? 0) + 1);
  const own = pa.pages
    .flatMap(({ v }) => {
      const url = /^https?:\/\//i.test(v.url) ? v.url : `https://${v.url}`;
      // A citation that isn't a valid web address can't be read; it's left out.
      if (!URL.canParse(url)) return [];
      // Normalised, so "site.com" and "site.com/" are one page.
      return [{ ...v, url: new URL(url).href, site: v.site ?? new URL(url).hostname.replace(/^www\./, "") }];
    })
    .filter((p) => (p.category === "other" || p.category === "unc") && ownSiteOf(p.site, [b]) === b.key)
    .sort((x, y) => (cites.get(y.key) ?? 0) - (cites.get(x.key) ?? 0) || x.url.localeCompare(y.url));
  if (!own.length) return null;
  const site = own[0]!.site;
  const home = `https://${site}/`;
  const urls = [...new Set([...own.filter((p) => p.site === site).map((p) => p.url), home])];
  // The cited pages first; the home page always gets one of the places.
  const cited = urls.filter((u) => u !== home).slice(0, MAX_PAGES_PER_COMPETITOR - 1);
  return { site, urls: [...cited, ...(cited.includes(home) ? [] : [home])] };
}
