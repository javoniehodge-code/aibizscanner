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

/** The site's name without its top-level domain, letters and digits only ("exoticmiamirental.com" -> "exoticmiamirental"). */
const siteLabel = (site: string) => site.toLowerCase().replace(/^www\./, "").replace(/\.[a-z]{2,}(\.[a-z]{2})?$/, "").replace(/[^a-z0-9]/g, "");

/**
 * The business whose own website this is, judged from the site's name alone: the site's name is the business's name
 * written together ("exoticmiamirental.com" for Exotic Miami Car Rental), allowing one word left out of a name of three
 * or more words. Used only for pages the classifier left unclassified, so a directory or review site keeps its group.
 */
export function ownSiteOf(site: string, businesses: readonly NamedBusiness[]): string | null {
  const label = siteLabel(site);
  if (label.length < 6) return null;
  for (const b of businesses) {
    // The name as normalised ("Red Hook Moving Co." -> red hook moving) and as written (red hook moving co).
    const spellings = [normalizeName(b.name), fold(b.name).toLowerCase().replace(/&/g, " and ").replace(/['’]/g, "").replace(/[^a-z0-9]+/g, " ")].map((n) => n.split(" ").filter(Boolean));
    for (const words of spellings) {
      const forms = [words.join("")];
      if (words.length >= 3) words.forEach((_, i) => forms.push(words.filter((__, j) => j !== i).join("")));
      if (forms.includes(label)) return b.key;
    }
  }
  return null;
}

export type Line = { name: string; questions: readonly string[] };
/** Pages a line may try in all (read or not), so a line whose sites keep refusing us doesn't take the whole run. */
export const MAX_TRIES_PER_LINE = PAGE_CAP * 2;

/**
 * The cited outside pages each line (or, without lines, the whole report) may check, most-cited first.
 * - Unclassified pages on another business's own website are left out (counted in ownSites).
 * - Directory pages whose site is named like a business are kept but marked: read, such a page counts as an outside
 *   site only when it names at least two other businesses (a marketplace such as giggster.com); otherwise it's that
 *   business's own website (partyfunrental.com for Party Fun Rental).
 */
export function candidatePages(section: SectionPages, businesses: readonly NamedBusiness[], lines: readonly Line[] | null) {
  const all = rankCitedPages(section);
  const own = new Set(all.filter((p) => p.category === "unc" && ownSiteOf(p.site, businesses)).map((p) => p.key));
  const suspects = new Map(all.filter((p) => p.category === "dir").flatMap((p) => { const b = ownSiteOf(p.site, businesses); return b ? [[p.key, b] as const] : []; }));
  const keep = (ps: RankedPage[]) => ps.filter((p) => !own.has(p.key));
  const lists = lines
    ? lines.map((l) => ({ line: l.name as string | null, pages: keep(rankCitedPages({ pages: section.pages, questions: section.questions.filter((q) => l.questions.includes(q.question.v.id)) })).map((p) => all.find((a) => a.key === p.key)!) }))
    : [{ line: null as string | null, pages: keep(all) }];
  return { lists, outside: all.length - own.size, ownSites: own.size, suspects };
}

/** Where each candidate page stands during the run. "own": read and found to be a business's own website. */
export type PageStatus = "read" | "failed" | "skipped" | "own";

/**
 * The next pages to fetch: for each list, its most-cited pages not yet tried, until the list has PAGE_CAP pages read
 * (pages being fetched count as read until we know) or has tried MAX_TRIES_PER_LINE pages. Pages on a site that has
 * refused us are passed over without a fetch ("skip") and don't count towards the cap. chosenBy records which lines
 * chose or passed over each page.
 */
export function planNext(lists: ReturnType<typeof candidatePages>["lists"], status: ReadonlyMap<string, PageStatus>, refused: ReadonlySet<string>, chosenBy: Map<string, Set<string>>) {
  const fetch = new Map<string, RankedPage>();
  const skip = new Map<string, RankedPage>();
  const mark = (key: string, line: string | null) => { if (line) chosenBy.set(key, (chosenBy.get(key) ?? new Set()).add(line)); };
  for (const { line, pages } of lists) {
    let need = PAGE_CAP - pages.filter((p) => status.get(p.key) === "read").length;
    let tries = pages.filter((p) => ["read", "failed"].includes(status.get(p.key) ?? "")).length;
    for (const p of pages) {
      if (need <= 0 || tries >= MAX_TRIES_PER_LINE) break;
      if (status.has(p.key) || skip.has(p.key)) continue;
      if (refused.has(p.site)) {
        skip.set(p.key, p);
        mark(p.key, line);
        continue;
      }
      if (!fetch.has(p.key)) fetch.set(p.key, p);
      mark(p.key, line);
      need--;
      tries++;
    }
  }
  return { fetch: [...fetch.values()], skip: [...skip.values()] };
}
