import { getDomain, getHostname } from "tldts";

/**
 * Cited sources: website and page keys, source groups and the evidence used to classify a page. Plain code only; the
 * model fallback (instruction prompt-analysis/classify-source) is called from the pa_sources stage and its output is
 * checked here (checkModelClassification).
 */

// ---------------------------------------------------------------------------------------------------------------
// Groups
// ---------------------------------------------------------------------------------------------------------------

/** Source group of one page. "company" splits into the report's two company groups by website ownership. */
export const SOURCE_GROUPS = ["company", "maps", "review", "dir", "ed", "comm", "off", "unc"] as const;
export type SourceGroup = (typeof SOURCE_GROUPS)[number];
/** Report page categories (the nine summary groups). */
export type PageCategory = "your" | "other" | "maps" | "review" | "dir" | "ed" | "comm" | "off" | "unc";
/** Why a page is Other / Unclassified: it is outside the taxonomy, or there wasn't enough evidence to decide. */
export type UnclassifiedKind = "outside" | "insufficient";
/** Who owns the website: the audited business (verified domain or alias), another business, or not established. */
export type SiteOwner = "target" | "business" | "unknown";

export function categoryOf(group: SourceGroup, owner: SiteOwner): PageCategory {
  if (group !== "company") return group;
  return owner === "target" ? "your" : "other";
}

// ---------------------------------------------------------------------------------------------------------------
// Page and website keys
// ---------------------------------------------------------------------------------------------------------------

/** Query parameters that only track a visit. Dropped from page keys; everything else identifies content and is kept. */
const TRACKING = /^(utm_\w+|gclid|gbraid|wbraid|dclid|fbclid|msclkid|yclid|mc_cid|mc_eid|_ga|_gl|igshid|si|ref|ref_src|srsltid|cmpid|campaign_id|trk|hsa_\w+)$/i;

/**
 * Page key: lower-cased host without "www.", the path without a trailing slash, and the content-identifying query
 * parameters (sorted). "https://www.Yelp.com/biz/x/?utm_source=chatgpt.com#top" -> "yelp.com/biz/x".
 * Returns null for anything that isn't an http(s) URL.
 */
export function pageKeyOf(raw: string): string | null {
  let u: URL;
  try {
    u = new URL(raw.trim());
  } catch {
    return null;
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return null;
  const host = u.hostname.toLowerCase().replace(/^www\./, "").replace(/\.$/, "");
  if (!host) return null;
  const params = [...u.searchParams.entries()].filter(([k]) => !TRACKING.test(k)).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  const path = u.pathname.replace(/\/+$/, "");
  const query = new URLSearchParams(params).toString();
  return host + path + (query ? "?" + query : "");
}

/**
 * Verified overrides where one registrable domain hosts many unrelated sites, so the website is narrower than the
 * domain. Each returns the website key, or null when it doesn't apply.
 */
const SHARED_HOSTING: ((host: string, path: string) => string | null)[] = [
  // Google Sites: sites.google.com/view/<name> and /site/<name>
  (h, p) => (h === "sites.google.com" ? ((m) => (m ? `sites.google.com/${m[1]}/${m[2]}` : null))(/^\/(view|site)\/([^/]+)/.exec(p)) : null),
  // US state government: dmv.ca.gov and dor.ca.gov are different agencies, not one website "ca.gov".
  (h) => ((m) => (m ? m[0] : null))(/[a-z0-9-]+\.[a-z]{2}\.gov$/.exec(h)),
];

export type SiteOptions = {
  /** Confirmed aliases: domains (and their subdomains) that belong to one website, mapped to that website's key. */
  aliases?: ReadonlyMap<string, string>;
};

/**
 * Website key for a page key: the registrable domain (public suffix list, private suffixes such as github.io
 * included), narrowed by the shared-hosting overrides and merged by confirmed aliases. Similar names stay separate
 * ("mphclub.com" and "mhp-miami.com" are two websites) unless an alias says otherwise.
 */
export function siteKeyOf(pageKey: string, opts: SiteOptions = {}): string {
  const slash = pageKey.indexOf("/");
  const host = slash < 0 ? pageKey.split("?")[0]! : pageKey.slice(0, slash);
  const path = slash < 0 ? "" : pageKey.slice(slash).split("?")[0]!;
  for (const [domain, site] of opts.aliases ?? []) if (host === domain || host.endsWith("." + domain)) return site;
  for (const rule of SHARED_HOSTING) {
    const hit = rule(host, path);
    if (hit) return hit;
  }
  return getDomain(host, { allowPrivateDomains: true }) ?? getHostname(host) ?? host;
}

/** Domain list ("www.mvpmiami.com", "https://mvpmiami.com/") -> bare hosts ("mvpmiami.com"). */
export function bareDomains(domains: readonly string[]): string[] {
  return [
    ...new Set(
      domains
        .map((d) => d.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "").replace(/^www\./, ""))
        .filter((d) => d.includes(".")),
    ),
  ];
}

// ---------------------------------------------------------------------------------------------------------------
// Verified domain and URL-pattern rules
// ---------------------------------------------------------------------------------------------------------------

export type RuleResult = { group: SourceGroup; rule: string };

/**
 * [website key pattern, page path pattern or null for any page, group, rule name]. Website keys are registrable
 * domains. Mixed-purpose domains have several rows, most specific first; a page matching none is left to the model.
 */
const RULES: [RegExp, RegExp | null, SourceGroup, string][] = [
  // Maps & places
  [/^google\.[a-z.]+$/, /^\/maps(\/|$)/, "maps", "Google Maps page"],
  [/^google\.[a-z.]+$/, /^\/(local|place)(\/|$)/, "maps", "Google place page"],
  [/^goo\.gl$/, /^\/maps(\/|$)/, "maps", "Google Maps short link"],
  [/^app\.goo\.gl$/, null, "maps", "Google Maps short link"],
  [/^apple\.com$/, /^\/maps(\/|$)/, "maps", "Apple Maps page"],
  [/^bing\.com$/, /^\/maps(\/|$)/, "maps", "Bing Maps page"],
  [/^mapquest\.com$/, null, "maps", "MapQuest"],
  [/^waze\.com$/, null, "maps", "Waze"],
  // Review platforms
  [/^yelp\.[a-z.]+$/, /^\/(biz|biz_photos)\//, "review", "Yelp business reviews"],
  [/^trustpilot\.com$/, /^\/review\//, "review", "Trustpilot reviews"],
  [/^tripadvisor\.[a-z.]+$/, /^\/(Attraction_Review|Restaurant_Review|Hotel_Review|ShowUserReviews|UserReview)/i, "review", "Tripadvisor reviews"],
  [/^birdeye\.com$/, null, "review", "Birdeye reviews"],
  [/^(consumeraffairs\.com|sitejabber\.com|reviews\.io|trustedshops\.com)$/, null, "review", "Review site"],
  [/^bbb\.org$/, /\/customer-reviews(\/|$)/, "review", "BBB customer reviews"],
  // Directories & marketplaces
  [/^yelp\.[a-z.]+$/, /^\/(search|c)(\/|$)/, "dir", "Yelp listings"],
  [/^tripadvisor\.[a-z.]+$/, /^\/(Attractions|Restaurants|Hotels|Tourism)-/i, "dir", "Tripadvisor listings"],
  [/^bbb\.org$/, null, "dir", "BBB business profile"],
  [/^(angi\.com|angieslist\.com|thumbtack\.com|yellowpages\.com|homeadvisor\.com|houzz\.com|porch\.com|manta\.com|superpages\.com|chamberofcommerce\.com|mapquest\.com)$/, null, "dir", "Business directory"],
  [/^nextdoor\.com$/, /^\/pages\//, "dir", "Nextdoor business page"],
  [/^(turo\.com|getaround\.com|getmyboat\.com|boatsetter\.com|airbnb\.[a-z.]+|vrbo\.com|booking\.com|expedia\.[a-z.]+|hotels\.com|kayak\.com|viator\.com|peerspace\.com|giggster\.com|tagvenue\.com|opentable\.com|resy\.com)$/, /^\/(blog|press|about|careers)(\/|$)/, "company", "Marketplace's own company page"],
  [/^(turo\.com|getaround\.com|getmyboat\.com|boatsetter\.com|airbnb\.[a-z.]+|vrbo\.com|booking\.com|expedia\.[a-z.]+|hotels\.com|kayak\.com|viator\.com|peerspace\.com|giggster\.com|tagvenue\.com|opentable\.com|resy\.com)$/, null, "dir", "Marketplace or booking page"],
  // Communities & social platforms
  [/^(reddit\.com|quora\.com|facebook\.com|fb\.com|instagram\.com|tiktok\.com|youtube\.com|youtu\.be|x\.com|twitter\.com|linkedin\.com|pinterest\.[a-z.]+|threads\.net|threads\.com|snapchat\.com|nextdoor\.com|tumblr\.com|discord\.com|stackexchange\.com|stackoverflow\.com)$/, null, "comm", "Community or social platform"],
  // Official & professional sources
  [/\.(gov|mil)$|\.gov\.[a-z]{2}$|\.gob\.[a-z]{2}$|\.gc\.ca$/, null, "off", "Government domain"],
  // Editorial & specialist publications (well-known publishers)
  [/^(wikipedia\.org|forbes\.com|nytimes\.com|timeout\.com|cntraveler\.com|thrillist\.com|eater\.com|bloomberg\.com|businessinsider\.com|usatoday\.com|cnn\.com|bbc\.co\.uk|bbc\.com|theguardian\.com|wsj\.com|washingtonpost\.com|travelandleisure\.com|caranddriver\.com|motortrend\.com|edmunds\.com|nerdwallet\.com|thepointsguy\.com|miaminewtimes\.com|miamiherald\.com)$/, null, "ed", "Publisher"],
];

/** Rule-based group for a page, or null when no verified rule applies. */
export function ruleGroup(pageKey: string, siteKey: string): RuleResult | null {
  const slash = pageKey.indexOf("/");
  const path = slash < 0 ? "/" : pageKey.slice(slash).split("?")[0]! || "/";
  const host = slash < 0 ? pageKey : pageKey.slice(0, slash);
  for (const [site, pathRe, group, rule] of RULES) {
    if (!site.test(siteKey) && !site.test(host)) continue;
    if (pathRe && !pathRe.test(path)) continue;
    return { group, rule };
  }
  return null;
}

// ---------------------------------------------------------------------------------------------------------------
// Evidence from the stored provider responses
// ---------------------------------------------------------------------------------------------------------------

/**
 * What the providers said about one cited URL: its title, and an excerpt. `from` says whose words the excerpt is:
 * "page" when the provider quotes the page itself (Anthropic cited_text), "answer" when it is the AI's own sentence
 * that cites the page (OpenAI, Gemini). The AI's sentence shows what a page covers, not who published it.
 */
export type CitationEvidence = { url: string; title: string | null; excerpt: string | null; from: "page" | "answer" };

const str = (x: unknown) => (typeof x === "string" && x.trim() ? x.trim() : null);
const clip = (s: string | null, n: number) => (s && s.length > n ? s.slice(0, n) + "…" : s);

/**
 * Titles and excerpts for cited URLs, read from a stored raw response (OpenAI Responses url_citation annotations,
 * Anthropic web_search_result_location citations, Gemini grounding chunks and supports). Unknown shapes yield nothing.
 */
export function citationEvidence(raw: unknown, answerText: string | null): CitationEvidence[] {
  const out: CitationEvidence[] = [];
  const walk = (node: unknown) => {
    if (Array.isArray(node)) return node.forEach(walk);
    if (!node || typeof node !== "object") return;
    const o = node as Record<string, unknown>;
    // OpenAI: { type: "url_citation", url, title, start_index, end_index } (indexes point into the answer text)
    if (o.type === "url_citation" && str(o.url)) {
      const s = typeof o.start_index === "number" && answerText ? answerText.slice(Math.max(0, o.start_index - 300), o.start_index).trim().split(/(?<=[.!?\n])\s/).pop() ?? null : null;
      out.push({ url: str(o.url)!, title: str(o.title), excerpt: clip(str(s), 300), from: "answer" });
    }
    // Anthropic: { type: "web_search_result_location", url, title, cited_text }
    if (o.type === "web_search_result_location" && str(o.url)) out.push({ url: str(o.url)!, title: str(o.title), excerpt: clip(str(o.cited_text), 300), from: "page" });
    // Gemini: groundingChunks[].web { uri, title }; groundingSupports[] { segment.text, groundingChunkIndices }
    const gm = o.groundingMetadata as { groundingChunks?: { web?: { uri?: unknown; title?: unknown } }[]; groundingSupports?: { segment?: { text?: unknown }; groundingChunkIndices?: unknown }[] } | undefined;
    if (gm && Array.isArray(gm.groundingChunks)) {
      const texts = new Map<number, string>();
      for (const s of gm.groundingSupports ?? []) {
        const t = str(s.segment?.text);
        if (t && Array.isArray(s.groundingChunkIndices)) for (const i of s.groundingChunkIndices) if (typeof i === "number" && !texts.has(i)) texts.set(i, t);
      }
      gm.groundingChunks.forEach((c, i) => {
        const uri = str(c.web?.uri);
        if (uri) out.push({ url: uri, title: str(c.web?.title), excerpt: clip(texts.get(i) ?? null, 300), from: "answer" });
      });
    }
    for (const v of Object.values(o)) if (v && typeof v === "object") walk(v);
  };
  walk(raw);
  return out;
}

// ---------------------------------------------------------------------------------------------------------------
// Model fallback: checking its answer
// ---------------------------------------------------------------------------------------------------------------

/** What the classifier is given about one page. `siblings`: other cited pages on the same website (url and title). */
export type PageEvidence = { pageKey: string; site: string; url: string; titles: string[]; pageText: string[]; aiSaid: string[]; siblings: { url: string; title: string | null }[] };
export type ModelVerdict = { pageKey: string; group: SourceGroup | "outside"; reason: string; evidence: string };
export type CheckedClassification = { group: SourceGroup; unclassified: UnclassifiedKind | null; reason: string; evidence: string | null; accepted: boolean };

/** Letters and digits only, lower-cased, accents removed: punctuation and Markdown don't decide whether a quote is there. */
const norm = (s: string) => s.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();

/**
 * Accepts a model verdict only when it names a valid group, gives a short reason, and quotes evidence that really is in
 * what it was given (the URL, a title, an excerpt or a sibling page; compared on letters and digits only). Anything else leaves the page unclassified for lack of evidence.
 * "outside" (a page that fits none of the groups) is kept as Other / Unclassified, marked as outside the taxonomy.
 */
export function checkModelClassification(v: ModelVerdict | undefined, ev: PageEvidence): CheckedClassification {
  const insufficient = (why: string): CheckedClassification => ({ group: "unc", unclassified: "insufficient", reason: why, evidence: null, accepted: false });
  if (!v) return insufficient("The classifier returned no verdict for this page.");
  const reason = v.reason.trim();
  if (!reason) return insufficient("The classifier gave no reason.");
  if (v.group === "unc") return { group: "unc", unclassified: "insufficient", reason, evidence: null, accepted: true };
  // The model often joins several short quotes ("title words; page words"). Each part must be found somewhere in the
  // evidence it was given; parts may come from different fields.
  const parts = (v.evidence ?? "").split(/;|\u2026|\.\.\./).map(norm).filter((q) => q.length > 0);
  const sources = [ev.url, ev.pageKey, ...ev.titles, ...ev.pageText, ...ev.aiSaid, ...ev.siblings.flatMap((x) => [x.url, x.title ?? ""])].map(norm);
  if (!parts.length || parts.join(" ").length < 3 || !parts.every((q) => sources.some((s) => s.includes(q)))) {
    return insufficient("The classifier's evidence wasn't found in the page details it was given.");
  }
  if (v.group === "outside") return { group: "unc", unclassified: "outside", reason, evidence: v.evidence.trim(), accepted: true };
  return { group: v.group, unclassified: null, reason, evidence: v.evidence.trim(), accepted: true };
}

// ---------------------------------------------------------------------------------------------------------------
// Website ownership: a business's own website
// ---------------------------------------------------------------------------------------------------------------

export type PageVerdict = { pageKey: string; site: string; group: SourceGroup; method: string; unclassified: UnclassifiedKind | null; reason: string; evidence: string | null };

/**
 * A business publishing about itself stays in Company websites, articles and guides included. When a website's pages
 * were judged company pages at least as often as editorial ones, the website is taken to be that business's own site,
 * and its pages judged editorial or left unclassified for lack of evidence become company pages. Rule-based groups
 * are never changed. Returns the pages that changed.
 */
export function applySiteOwnership(pages: readonly PageVerdict[]): Map<string, PageVerdict> {
  const bySite = new Map<string, PageVerdict[]>();
  for (const p of pages) bySite.set(p.site, [...(bySite.get(p.site) ?? []), p]);
  const changed = new Map<string, PageVerdict>();
  for (const [site, list] of bySite) {
    const company = list.filter((p) => p.group === "company");
    const editorial = list.filter((p) => p.group === "ed").length;
    if (!company.length || company.length < editorial) continue;
    const anchor = company[0]!;
    for (const p of list) {
      if (p.method === "rule" || p.method === "alias" || !(p.group === "ed" || (p.group === "unc" && p.unclassified === "insufficient"))) continue;
      changed.set(p.pageKey, {
        ...p,
        group: "company",
        unclassified: null,
        reason: `On ${site}, a business's own website (${company.length} of its cited page${company.length === 1 ? " is a company page" : "s are its own company pages"}, e.g. ${anchor.pageKey}): the business publishing about itself.`,
      });
    }
  }
  return changed;
}
