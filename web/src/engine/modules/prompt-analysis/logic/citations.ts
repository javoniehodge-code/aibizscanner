/** Page categories of the report schema (fixtures/report.schema.json → promptAnalysis.pages[].category). */
export type PageCategory = "your" | "other" | "maps" | "review" | "dir" | "ed" | "comm" | "off" | "unc";

const PREFIX: Record<PageCategory, string> = { your: "yw", other: "oc", maps: "mp", review: "rv", dir: "dr", ed: "ed", comm: "cm", off: "of", unc: "un" };
const TRACKING = /^(utm_\w+|gclid|fbclid|msclkid|mc_cid|mc_eid|ref|ref_src|srsltid)$/i;

/** "https://www.Yelp.com/biz/x/?utm_source=chatgpt.com#top" -> "yelp.com/biz/x". Returns null for non-web URLs. */
export function normalizeUrl(raw: string): string | null {
  let u: URL;
  try {
    u = new URL(raw.trim());
  } catch {
    return null;
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return null;
  const host = u.hostname.toLowerCase().replace(/^www\./, "");
  for (const k of [...u.searchParams.keys()]) if (TRACKING.test(k)) u.searchParams.delete(k);
  const path = u.pathname.replace(/\/+$/, "");
  const query = u.searchParams.toString();
  return host + path + (query ? "?" + query : "");
}

const RULES: [PageCategory, RegExp][] = [
  ["maps", /^(maps\.google\.[a-z.]+|google\.[a-z.]+\/maps|maps\.apple\.com|bing\.com\/maps|goo\.gl\/maps)/],
  ["review", /^(yelp\.[a-z.]+|trustpilot\.com|tripadvisor\.[a-z.]+|consumeraffairs\.com|birdeye\.com|reviews\.io|sitejabber\.com)(\/|$)/],
  ["dir", /^(angi\.com|angieslist\.com|thumbtack\.com|yellowpages\.com|bbb\.org|homeadvisor\.com|houzz\.com|porch\.com|nextdoor\.com\/pages|manta\.com|superpages\.com)(\/|$)/],
  ["comm", /^(reddit\.com|old\.reddit\.com|quora\.com|nextdoor\.com|facebook\.com\/groups|community\.)/],
  ["off", /^([a-z0-9.-]+\.gov|[a-z0-9.-]+\.gov\.[a-z]{2}|[a-z0-9.-]+\.mil)(\/|$)/],
];

/**
 * Category by rule. Own domains -> "your", known competitor domains -> "other", well-known platforms by pattern.
 * Anything else is "unc" (unclassified) and is left for the source-classification step (stage 8) to judge.
 */
export function classifyPage(page: string, ownDomains: readonly string[], competitorDomains: readonly string[]): PageCategory {
  const host = page.split("/")[0] ?? "";
  const onDomain = (d: string) => host === d || host.endsWith("." + d);
  if (ownDomains.some(onDomain)) return "your";
  if (competitorDomains.some(onDomain)) return "other";
  for (const [cat, re] of RULES) if (re.test(page)) return cat;
  return "unc";
}

export type CitedPage = { key: string; url: string; category: PageCategory };

/** Assigns stable keys (yw, yw2, rv1, …) to distinct pages in order of first citation. */
export class PageRegistry {
  private readonly byUrl = new Map<string, CitedPage>();
  private readonly counts = new Map<PageCategory, number>();
  constructor(
    private readonly ownDomains: readonly string[],
    private readonly competitorDomains: readonly string[],
  ) {}
  /** Key for a cited URL (registering it on first sight), or null if it isn't a web URL. */
  keyFor(rawUrl: string): string | null {
    const url = normalizeUrl(rawUrl);
    if (!url) return null;
    const existing = this.byUrl.get(url);
    if (existing) return existing.key;
    const category = classifyPage(url, this.ownDomains, this.competitorDomains);
    const n = (this.counts.get(category) ?? 0) + 1;
    this.counts.set(category, n);
    const key = category === "your" && n === 1 ? "yw" : PREFIX[category] + n;
    const page = { key, url, category };
    this.byUrl.set(url, page);
    return key;
  }
  pages(): CitedPage[] {
    return [...this.byUrl.values()];
  }
}
