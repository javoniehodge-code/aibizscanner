import { normalizeName } from "../../prompt-analysis/logic/names";

/**
 * Stage 8, plain code: which cited outside pages we check, and which businesses each checked page names.
 * credible-corroborated.md §2: rank exact pages by the distinct prompts that cited them (a page counts once per prompt,
 * however many AIs cited it). Ranking says nothing about a page's quality or influence.
 */
export const CITED_PAGES_VERSION = "2026-11-19";
/** Owner decision (19 Nov 2026): at most this many cited pages are fetched per report. */
export const PAGE_CAP = 20;

/** Outside pages: every page category except the business's own website and other businesses' own websites. */
export const OUTSIDE_CATEGORIES = ["maps", "review", "dir", "ed", "comm", "off", "unc"] as const;
export type OutsideCategory = (typeof OUTSIDE_CATEGORIES)[number];
export const CATEGORY_LABEL: Record<OutsideCategory, string> = {
  maps: "Maps & places",
  review: "Review platform",
  dir: "Directory & marketplace",
  ed: "Editorial & publication",
  comm: "Community & social",
  off: "Official & professional",
  unc: "Other / unclassified",
};

/** What the ranking needs from the report's promptAnalysis section. */
export type SectionPages = {
  pages: readonly { v: { key: string; url: string; category: string; site?: string; title?: string | null } }[];
  questions: readonly { question: { v: { id: string } }; answers: readonly { v: { status: string; citations?: readonly string[] } }[] }[];
};

export type RankedPage = { key: string; url: string; site: string; category: OutsideCategory; title: string | null; prompts: number; answers: number; engines: number[] };

/** Outside cited pages, most distinct prompts first; ties by answers citing the page, then page key. */
export function rankCitedPages(section: SectionPages): RankedPage[] {
  const stats = new Map<string, { prompts: Set<string>; answers: number; engines: Set<number> }>();
  for (const q of section.questions) {
    q.answers.forEach((a, engine) => {
      if (a.v.status !== "ok") return;
      for (const key of new Set(a.v.citations ?? [])) {
        const s = stats.get(key) ?? { prompts: new Set(), answers: 0, engines: new Set() };
        s.prompts.add(q.question.v.id);
        s.answers++;
        s.engines.add(engine);
        stats.set(key, s);
      }
    });
  }
  const out: RankedPage[] = [];
  for (const { v: p } of section.pages) {
    if (!(OUTSIDE_CATEGORIES as readonly string[]).includes(p.category)) continue;
    const s = stats.get(p.key);
    if (!s) continue;
    // Older reports store URLs without the scheme ("yelp.com/biz/x").
    const url = /^https?:\/\//i.test(p.url) ? p.url : `https://${p.url}`;
    out.push({
      key: p.key,
      url,
      site: p.site ?? new URL(url).hostname.replace(/^www\./, ""),
      category: p.category as OutsideCategory,
      title: p.title ?? null,
      prompts: s.prompts.size,
      answers: s.answers,
      engines: [...s.engines].sort(),
    });
  }
  return out.sort((a, b) => b.prompts - a.prompts || b.answers - a.answers || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
}

export type NamedBusiness = { key: string; name: string; aliases?: readonly string[] };
export type NameFound = { business: string; excerpt: string };

const fold = (s: string) => s.normalize("NFKD").replace(/\p{M}/gu, "");
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * A pattern for one business name, matched on whole words. Words come from normalizeName ("The Maimon Group" ->
 * "maimon group"); "and" also matches "&"; a word ending in s also matches "'s". Names of two or more words match in
 * any letter case. A one-word name ("Turo", "Enterprise") must be written with its capital letters as in the name, so
 * an ordinary word ("enterprise") doesn't count as the business.
 */
function namePattern(name: string): RegExp | null {
  const words = normalizeName(name).split(" ").filter(Boolean);
  if (!words.length) return null;
  if (words.length === 1) {
    const original = fold(name).match(/[\p{L}\p{N}]+/gu)?.find((w) => w.toLowerCase() === words[0]);
    if (!original || original.length < 3) return null;
    return new RegExp(`(?<![\\p{L}\\p{N}])${esc(original)}(?![\\p{L}\\p{N}])`, "u");
  }
  const parts = words.map((w) => (w === "and" ? "(?:and|&)" : w.endsWith("s") && w.length > 2 ? `${esc(w.slice(0, -1))}['’]?s` : esc(w)));
  // A name ending in a letter may run straight into a number when page elements join ("MVP Miami103 vehicles").
  const end = /\p{L}$/u.test(words.at(-1)!) ? "(?!\\p{L})" : "(?![\\p{L}\\p{N}])";
  return new RegExp(`(?<![\\p{L}\\p{N}])${parts.join("[^\\p{L}\\p{N}]+")}${end}`, "iu");
}

/** A short excerpt around a match, cut at word boundaries. */
function excerptAround(text: string, index: number, length: number, room = 120): string {
  let start = Math.max(0, index - room);
  let end = Math.min(text.length, index + length + room);
  if (start > 0) start = text.indexOf(" ", start) + 1 || start;
  if (end < text.length) end = text.lastIndexOf(" ", end) > index + length ? text.lastIndexOf(" ", end) : end;
  return `${start > 0 ? "…" : ""}${text.slice(start, end).replace(/\s+/g, " ").trim()}${end < text.length ? "…" : ""}`;
}

/** Businesses named on a page (its title and text), each with the words around the first mention. */
export function namesOnPage(page: { title: string | null; text: string }, businesses: readonly NamedBusiness[]): NameFound[] {
  const text = fold([page.title ?? "", page.text].join("\n"));
  const out: NameFound[] = [];
  for (const b of businesses) {
    let best: RegExpExecArray | null = null;
    for (const n of [b.name, ...(b.aliases ?? [])]) {
      const re = namePattern(n);
      const m = re?.exec(text) ?? null;
      if (m && (!best || m.index < best.index)) best = m;
    }
    if (best) out.push({ business: b.key, excerpt: excerptAround(text, best.index, best[0].length) });
  }
  return out;
}

/** Words of visible text (as the website checks count them). */
export const wordCount = (text: string) => text.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
