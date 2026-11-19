import { parse, type HTMLElement } from "node-html-parser";

/** What we read from one HTML page: identity, structure, main text and structured data. Plain code, no model. */
export type PageExtract = {
  title: string | null;
  description: string | null;
  canonical: string | null;
  /** robots meta directives (e.g. "noindex, nofollow"), lower-cased. */
  metaRobots: string | null;
  headings: { level: number; text: string }[];
  /** Visible main text: <main>/<article> when present, else the body without navigation, header, footer and scripts. */
  text: string;
  wordCount: number;
  /** JSON-LD blocks: the schema.org types each declares, and the parsed value (null when it isn't valid JSON). */
  jsonLd: { types: string[]; value: unknown; error: string | null }[];
  /** Microdata types (itemtype) present on the page. */
  microdataTypes: string[];
};

const clean = (s: string | undefined | null) => (s ?? "").replace(/\s+/g, " ").trim();
const MAX_TEXT = 200_000;

function typesOf(v: unknown): string[] {
  const out = new Set<string>();
  const walk = (x: unknown) => {
    if (Array.isArray(x)) return x.forEach(walk);
    if (!x || typeof x !== "object") return;
    const o = x as Record<string, unknown>;
    const t = o["@type"];
    if (typeof t === "string") out.add(t);
    if (Array.isArray(t)) t.forEach((y) => typeof y === "string" && out.add(y));
    if (o["@graph"]) walk(o["@graph"]);
  };
  walk(v);
  return [...out];
}

function visibleText(root: HTMLElement, whole = false): string {
  const main = (whole ? null : (root.querySelector("main") ?? root.querySelector("article"))) ?? root.querySelector("body") ?? root;
  const copy = parse(main.toString());
  for (const sel of ["script", "style", "noscript", "template", "svg", "iframe", "nav", "header", "footer", "form"]) copy.querySelectorAll(sel).forEach((n) => n.remove());
  // Block elements become line breaks so words from different blocks don't run together.
  let html = copy.toString().replace(/<\/(p|div|li|h[1-6]|tr|section|article|br)\s*>/gi, "$&\n").replace(/<br\s*\/?>/gi, "\n");
  // Whole-body reading (cited pages): inline elements next to each other ("<span>MVP Miami</span><span>103 vehicles</span>")
  // are separated, so a name doesn't run into the next word. The website checks keep their existing text.
  if (whole) html = html.replace(/<\/(a|span|strong|em|b|i|small|label|button|td|th|dt|dd)\s*>/gi, "$& ");
  return parse(html)
    .textContent.split("\n")
    // Malformed pages can leave markup in the text (a second "<!DOCTYPE html>" inside the body, stray tags).
    .map((l) => l.replace(/<!doctype[^>]*>|<\/?[a-z][^>]*>/gi, " ").replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n")
    .slice(0, MAX_TEXT);
}

/**
 * `wholeBody`: read the whole body (still without navigation, header, footer, forms and scripts) instead of only
 * <main>/<article>. The cited-page check uses it: a listing or article can name businesses outside the main element.
 */
export function extractPage(html: string, opts: { wholeBody?: boolean } = {}): PageExtract {
  const root = parse(html, { comment: false, blockTextElements: { script: true, style: true, noscript: true, pre: true } });
  const meta = (name: string) => clean(root.querySelector(`meta[name="${name}"]`)?.getAttribute("content")) || null;
  const jsonLd = root.querySelectorAll('script[type="application/ld+json"]').map((s) => {
    const raw = s.textContent.trim();
    try {
      const value = JSON.parse(raw) as unknown;
      return { types: typesOf(value), value, error: null };
    } catch (e) {
      return { types: [], value: null, error: e instanceof Error ? e.message : String(e) };
    }
  });
  const text = visibleText(root, opts.wholeBody);
  return {
    title: clean(root.querySelector("title")?.textContent) || null,
    description: meta("description") ?? (clean(root.querySelector('meta[property="og:description"]')?.getAttribute("content")) || null),
    canonical: clean(root.querySelector('link[rel="canonical"]')?.getAttribute("href")) || null,
    metaRobots: meta("robots")?.toLowerCase() ?? null,
    headings: root
      .querySelectorAll("h1, h2, h3")
      .map((h) => ({ level: Number(h.tagName.slice(1)), text: clean(h.textContent) }))
      .filter((h) => h.text)
      .slice(0, 80),
    text,
    wordCount: text ? text.split(/\s+/).length : 0,
    jsonLd,
    microdataTypes: [...new Set(root.querySelectorAll("[itemtype]").map((n) => clean(n.getAttribute("itemtype"))).filter(Boolean))],
  };
}

/** Links on a page: absolute http(s) URLs without fragments, and whether each sits in navigation (nav/header/footer). */
export function extractLinks(html: string, baseUrl: string): { url: string; text: string; inNav: boolean }[] {
  const root = parse(html, { comment: false });
  const navLinks = new Set(root.querySelectorAll("nav a, header a, footer a"));
  const out = new Map<string, { url: string; text: string; inNav: boolean }>();
  for (const a of root.querySelectorAll("a[href]")) {
    const href = a.getAttribute("href")!.trim();
    if (!href || /^(mailto|tel|javascript|sms|data):/i.test(href) || href.startsWith("#")) continue;
    let u: URL;
    try {
      u = new URL(href, baseUrl);
    } catch {
      continue;
    }
    if (u.protocol !== "http:" && u.protocol !== "https:") continue;
    u.hash = "";
    const key = u.toString();
    const prev = out.get(key);
    const inNav = navLinks.has(a) || (prev?.inNav ?? false);
    out.set(key, { url: key, text: prev?.text || clean(a.textContent).slice(0, 120), inNav });
  }
  return [...out.values()];
}

/** <loc> entries of a sitemap or sitemap index. */
export function parseSitemap(xml: string): { kind: "index" | "urlset" | "unknown"; locs: string[] } {
  const kind = /<sitemapindex[\s>]/i.test(xml) ? "index" : /<urlset[\s>]/i.test(xml) ? "urlset" : "unknown";
  const locs = [...xml.matchAll(/<loc>\s*(?:<!\[CDATA\[)?\s*([^<\]]+?)\s*(?:\]\]>)?\s*<\/loc>/gi)].map((m) => m[1]!.replace(/&amp;/g, "&").trim());
  return { kind, locs };
}
