import { hoursValue, phoneValue } from "./findread";
import { keyFacts } from "./jscheck";

/**
 * Structured data check (report-tech-requirements.md §4): the facts your site's code states for machines (JSON-LD),
 * compared with what your pages show. Plain code, no model. The code is read from our plain copy of each page (what
 * crawlers read); the page facts from our browser copy (what a visitor sees). Results: match, conflict, or missing
 * from the code. A fact that only one side states is reported only when it's the code that lacks it.
 */
export const STRUCTURED_CHECK_VERSION = "2026-11-18";

export type Mark = "g" | "r" | "k";
export type CheckedPage = { url: string; name: string; kind: string; jsonLd: { types: string[]; value: unknown; error: string | null }[]; text: string | null };
export type Fact = {
  fact: string;
  /** What the pages show, and the page it was seen on. */
  page: string;
  pageUrl: string | null;
  /** What the code says. */
  code: string;
  mark: Mark;
  /** Where in the code, for the website manager. */
  where: string;
  title: string;
  why: string;
  fix: string;
};
export type StructuredResult = {
  pages: { url: string; name: string; types: string[]; blocks: number; errors: number }[];
  business: { url: string; type: string } | null;
  facts: Fact[];
  broken: { url: string; name: string; errors: number }[];
};

type Node = Record<string, unknown>;
const NOT_BUSINESS = new Set(["WebSite", "WebPage", "BreadcrumbList", "ListItem", "Person", "Article", "BlogPosting", "ImageObject", "SiteNavigationElement", "SearchAction", "ReadAction", "EntryPoint"]);
const str = (x: unknown): string | null => (typeof x === "string" && x.trim() ? x.trim() : typeof x === "number" ? String(x) : null);
const typesOf = (n: Node): string[] => (Array.isArray(n["@type"]) ? (n["@type"] as unknown[]).filter((t): t is string => typeof t === "string") : typeof n["@type"] === "string" ? [n["@type"] as string] : []);
const loose = (s: string) => s.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();

/** Every object with an @type, anywhere in a JSON-LD value (including @graph and nested values). */
export function nodes(value: unknown): Node[] {
  const out: Node[] = [];
  const walk = (x: unknown) => {
    if (Array.isArray(x)) return x.forEach(walk);
    if (!x || typeof x !== "object") return;
    const o = x as Node;
    if (typesOf(o).length) out.push(o);
    for (const v of Object.values(o)) if (v && typeof v === "object") walk(v);
  };
  walk(value);
  return out;
}

/** The business itself: a typed node stating a phone, address or opening hours, that isn't a page, list or article. */
export function businessNode(pages: readonly CheckedPage[]): { node: Node; url: string; type: string } | null {
  const ordered = [...pages].sort((a, b) => (a.kind === "home" ? -1 : 0) - (b.kind === "home" ? -1 : 0));
  for (const p of ordered)
    for (const block of p.jsonLd)
      for (const n of nodes(block.value)) {
        const types = typesOf(n);
        if (types.every((t) => NOT_BUSINESS.has(t))) continue;
        if (n.telephone || n.address || n.openingHours || n.openingHoursSpecification) return { node: n, url: p.url, type: types.find((t) => !NOT_BUSINESS.has(t)) ?? types[0]! };
      }
  return null;
}

/** "Mo-Su 09:30-21:30" or openingHoursSpecification -> "9:30-21:30" (the page check's hours format), with the raw text. */
export function codeHours(n: Node): { value: string | null; raw: string } | null {
  const fmt = (t: string) => {
    const [h, m] = t.split(":");
    return `${Number(h)}${m && m !== "00" ? `:${m}` : ""}`;
  };
  const oh = n.openingHours;
  const list = Array.isArray(oh) ? oh.map(str).filter((x): x is string => !!x) : str(oh) ? [str(oh)!] : [];
  if (list.length) {
    const m = /(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})/.exec(list[0]!);
    return { value: m ? `${fmt(m[1]!)}-${fmt(m[2]!)}` : null, raw: list.join("; ") };
  }
  const spec = n.openingHoursSpecification;
  const specs = (Array.isArray(spec) ? spec : spec ? [spec] : []) as Node[];
  const first = specs.find((s) => str(s.opens) && str(s.closes));
  if (!first) return null;
  const days = (s: Node) => (Array.isArray(s.dayOfWeek) ? (s.dayOfWeek as unknown[]).map(str).join(", ") : (str(s.dayOfWeek) ?? "")).replace(/https?:\/\/schema\.org\//g, "");
  return { value: `${fmt(str(first.opens)!)}-${fmt(str(first.closes)!)}`, raw: specs.map((s) => `${days(s)} ${str(s.opens)}-${str(s.closes)}`.trim()).join("; ") };
}

function hasPrice(value: unknown): boolean {
  return nodes(value).some((n) => typesOf(n).some((t) => /Offer|PriceSpecification/.test(t)) && (n.price != null || n.lowPrice != null || n.priceSpecification != null));
}

export function checkStructuredData(pages: readonly CheckedPage[], business: { name: string }): StructuredResult {
  const facts: Fact[] = [];
  const found = businessNode(pages);
  const n = found?.node ?? null;
  const where = found ? `JSON-LD block, @type ${found.type}` : "No business block in the code";
  const lines = pages.flatMap((p) => (p.text ?? "").split("\n").map((l) => ({ l: l.trim(), p })).filter((x) => x.l));
  const seen = (kind: "phone" | "hours" | "price") => lines.flatMap(({ l, p }) => keyFacts([l]).filter((f) => f.kind === kind).map((f) => ({ text: f.text, p })));

  // Business name.
  const codeName = n ? str(n.name) : null;
  if (codeName) {
    const ok = loose(codeName).includes(loose(business.name)) || loose(business.name).includes(loose(codeName));
    facts.push({
      fact: "Business name", page: business.name, pageUrl: null, code: codeName, mark: ok ? "g" : "r", where: `${where} → name`,
      title: `Your site's code names the business "${codeName}", not "${business.name}".`,
      why: "AI tools that read your code may use the wrong name for you.",
      fix: `Set "name" to "${business.name}".`,
    });
  }

  // Phone.
  const phones = seen("phone");
  const codePhone = n ? str(n.telephone) : null;
  if (codePhone || phones.length) {
    const match = codePhone ? phones.find((x) => phoneValue(x.text) === phoneValue(codePhone)) : undefined;
    const shown = match ?? phones[0];
    if (!codePhone)
      facts.push({ fact: "Phone", page: shown!.text, pageUrl: shown!.p.url, code: "Not in code", mark: "k", where: `${where}. No telephone property.`, title: "Your pages show your phone number, but your site's code doesn't list it.", why: "AI tools that read your code can't give customers your number from it.", fix: `Add "telephone": "${shown!.text}".` });
    else if (phones.length)
      facts.push({ fact: "Phone", page: shown!.text, pageUrl: shown!.p.url, code: codePhone, mark: match ? "g" : "r", where: `${where} → telephone`, title: `Your pages show ${shown!.text}, but your site's code says ${codePhone}.`, why: "AI tools that read your code may give customers the wrong number.", fix: `Change "telephone" to "${shown!.text}".` });
  }

  // Address: the code's street or postal code on any page.
  const addr = n && n.address && typeof n.address === "object" ? (n.address as Node) : null;
  const street = addr ? str(addr.streetAddress) : null;
  const postal = addr ? str(addr.postalCode) : null;
  if (addr && (street || postal)) {
    const codeText = [street, str(addr.addressLocality), str(addr.addressRegion), postal].filter(Boolean).join(", ");
    const hit = lines.find(({ l }) => (street && loose(l).includes(loose(street))) || (postal && new RegExp(`\\b${postal}\\b`).test(l)));
    if (hit)
      facts.push({ fact: "Address", page: hit.l.slice(0, 80), pageUrl: hit.p.url, code: codeText, mark: "g", where: `${where} → address`, title: "", why: "", fix: "" });
  }

  // Opening hours.
  const hours = seen("hours").map((x) => ({ ...x, value: hoursValue(x.text) })).filter((x) => x.value);
  const ch = n ? codeHours(n) : null;
  if (ch || hours.length) {
    const match = ch?.value ? hours.find((x) => x.value === ch.value) : undefined;
    const shown = match ?? hours[0];
    if (!ch && shown)
      facts.push({ fact: "Hours", page: shown.text, pageUrl: shown.p.url, code: "Not in code", mark: "k", where: `${where}. No openingHours property.`, title: "Your pages list your opening hours, but your site's code doesn't.", why: "AI tools that read your code can't tell customers when you're open.", fix: `Add "openingHours" with the hours your pages show (${shown.text}).` });
    else if (ch && shown)
      facts.push({ fact: "Hours", page: shown.text, pageUrl: shown.p.url, code: ch.raw, mark: match ? "g" : "r", where: `${where} → openingHours`, title: `Your pages say you're open ${shown.text}, but your site's code says ${ch.raw}.`, why: "AI tools that read your code may tell customers the wrong opening hours.", fix: `Change the opening hours in the code to match your pages (${shown.text}).` });
  }

  // Prices: shown on pages, stated in the code?
  const prices = seen("price");
  if (prices.length) {
    const inCode = pages.some((p) => p.jsonLd.some((b) => hasPrice(b.value)));
    const range = n ? str(n.priceRange) : null;
    const top = [...prices.reduce((m, x) => m.set(x.p.url, { p: x.p, n: (m.get(x.p.url)?.n ?? 0) + 1 }), new Map<string, { p: CheckedPage; n: number }>()).values()].sort((a, b) => b.n - a.n)[0]!;
    facts.push({
      fact: "Prices", page: `${prices.length} ${prices.length === 1 ? "price" : "prices"}, e.g. ${prices[0]!.text} (${top.p.name})`, pageUrl: top.p.url,
      code: inCode ? "Prices stated" : range ? `Only a price range: ${range}` : "Not in code", mark: inCode ? "g" : "k",
      where: inCode ? "JSON-LD Offer / price" : `${where}. No Offer with a price.`,
      title: `Your pages show prices, but your site's code ${range ? `only gives the price range "${range}"` : "says nothing about prices"}.`,
      why: "Prices are one of the first things customers ask AI about.",
      fix: "Add an Offer with its price for each vehicle or service whose price your pages show.",
    });
  }

  // FAQ page marked up as questions and answers.
  for (const faq of pages.filter((p) => p.kind === "faq")) {
    const marked = faq.jsonLd.some((b) => b.types.includes("FAQPage"));
    facts.push({
      fact: "FAQs", page: `${faq.name}`, pageUrl: faq.url, code: marked ? "Marked as questions and answers" : "Not in code", mark: marked ? "g" : "k",
      where: marked ? "JSON-LD FAQPage" : "No FAQPage markup on this page.",
      title: "Your FAQ page answers common questions, but its code doesn't mark them as questions and answers.",
      why: "Marked-up answers are easier for AI to quote accurately.",
      fix: "Add FAQPage markup with each question and its answer.",
    });
  }

  return {
    pages: pages.map((p) => ({ url: p.url, name: p.name, types: [...new Set(p.jsonLd.flatMap((b) => b.types))], blocks: p.jsonLd.length, errors: p.jsonLd.filter((b) => b.error).length })),
    business: found ? { url: found.url, type: found.type } : null,
    facts,
    broken: pages.flatMap((p) => {
      const errors = p.jsonLd.filter((b) => b.error).length;
      return errors ? [{ url: p.url, name: p.name, errors }] : [];
    }),
  };
}
