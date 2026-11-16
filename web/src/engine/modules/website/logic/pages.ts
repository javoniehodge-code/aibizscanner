import { pageKeyOf, siteKeyOf } from "../../prompt-analysis/logic/sources";

/** What a page is for, from its URL (and link text when we have it). Plain keyword rules; a page can be "other". */
export const PAGE_KINDS = ["home", "contact", "booking", "faq", "pricing", "service", "location", "policy", "about", "blog", "other"] as const;
export type PageKind = (typeof PAGE_KINDS)[number];

const KIND_RULES: [PageKind, RegExp][] = [
  ["contact", /(^|[/_-])(contact|contact-us|get-in-touch|reach-us)([/_.-]|$)/i],
  ["booking", /(^|[/_-])(book|booking|bookings|reserve|reservations?|quote|get-a-quote|request|inquire|inquiry|enquiry)([/_.-]|$)/i],
  ["faq", /(^|[/_-])(faqs?|questions|help|how-it-works)([/_.-]|$)/i],
  ["pricing", /(^|[/_-])(pricing|prices?|rates?|costs?|packages|plans|specials|deals)([/_.-]|$)/i],
  ["policy", /(^|[/_-])(terms|tos|policy|policies|privacy|cancellation|refunds?|rental-agreement|agreement|requirements|insurance|disclaimer)([/_.-]|$)/i],
  ["about", /(^|[/_-])(about|about-us|our-story|team|who-we-are)([/_.-]|$)/i],
  ["location", /(^|[/_-])(locations?|areas?|service-areas?|cities|near-me|directions|airport)([/_.-]|$)/i],
  ["blog", /(^|[/_-])(blog|news|articles?|posts?|guides?|press)([/_.-]|$)/i],
];
/** Pages that are never worth checking: accounts, carts, search results, feeds, admin, files. */
const EXCLUDE = /(^|\/)(cart|checkout|account|my-account|login|log-in|signin|sign-in|register|signup|wp-admin|wp-json|wp-login|feed|tag|author|search|cdn-cgi)(\/|$)|[?&](s|q|replytocom|add-to-cart)=|\/page\/\d+|\.(pdf|jpe?g|png|gif|webp|svg|zip|mp4|mp3|css|js|xml|json|txt|ico)$/i;

export function pageKind(url: string): PageKind {
  let path: string;
  try {
    path = new URL(url).pathname.replace(/\/+$/, "") || "/";
  } catch {
    return "other";
  }
  if (path === "/" || /^\/(index|home)(\.\w+)?$/i.test(path)) return "home";
  for (const [kind, re] of KIND_RULES) if (re.test(path)) return kind;
  return "other";
}

export function excluded(url: string): boolean {
  try {
    const u = new URL(url);
    return EXCLUDE.test(u.pathname + u.search);
  } catch {
    return true;
  }
}

export type Candidate = { url: string; kind: PageKind; sources: ("home" | "nav" | "link" | "sitemap" | "cited")[]; linkText: string | null };
export type Suggested = { url: string; kind: PageKind; reason: string };

/** Words of a service or location, for matching URLs ("Exotic car rentals" -> ["exotic", "car", "rentals"]). */
const words = (s: string) => s.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length >= 3 && !["and", "the", "for", "with", "rental", "rentals", "services", "service"].includes(w));

/**
 * Suggests up to `cap` pages to check, in priority order (website-discovery-accessibility.md §3): the home page; own
 * pages an AI cited in the prompt analysis; contact, booking, FAQ and pricing; one page per listed service; location
 * pages; one policy page; the about page; then other navigation pages. The admin reviews and approves the list.
 */
export function suggestPages(candidates: readonly Candidate[], opts: { services: readonly string[]; locations: readonly string[]; cap: number }): Suggested[] {
  const picked = new Map<string, Suggested>();
  const add = (c: Candidate | undefined, reason: string) => {
    if (!c || picked.size >= opts.cap) return;
    const key = pageKeyOf(c.url);
    if (!key || picked.has(key)) return;
    picked.set(key, { url: c.url, kind: c.kind, reason });
  };
  const navFirst = (list: Candidate[]) => [...list].sort((a, b) => Number(b.sources.includes("nav")) - Number(a.sources.includes("nav")) || a.url.length - b.url.length);
  const ofKind = (k: PageKind) => navFirst(candidates.filter((c) => c.kind === k));
  const matches = (c: Candidate, ws: string[]) => ws.length > 0 && ws.every((w) => `${c.url} ${c.linkText ?? ""}`.toLowerCase().includes(w));

  add(ofKind("home")[0], "Home page");
  for (const c of candidates.filter((x) => x.sources.includes("cited"))) add(c, "Cited by an AI in the prompt analysis");
  add(ofKind("contact")[0], "Contact page");
  add(ofKind("booking")[0], "Booking or quote page");
  add(ofKind("faq")[0], "FAQ page");
  add(ofKind("pricing")[0], "Pricing page");
  for (const s of opts.services) {
    const ws = words(s);
    add(navFirst(candidates.filter((c) => c.kind !== "blog" && matches(c, ws)))[0] ?? navFirst(candidates.filter((c) => c.kind !== "blog" && ws.some((w) => c.url.toLowerCase().includes(w))))[0], `Service: ${s}`);
  }
  for (const l of opts.locations) add(navFirst(candidates.filter((c) => matches(c, words(l))))[0], `Location: ${l}`);
  for (const c of ofKind("location").slice(0, 2)) add(c, "Location page");
  const policies = ofKind("policy");
  add(policies.find((c) => !/privacy/i.test(c.url)) ?? policies[0], "Policies or rental terms");
  add(ofKind("about")[0], "About page");
  for (const c of navFirst(candidates.filter((x) => x.sources.includes("nav") && (x.kind === "other" || x.kind === "location")))) add(c, "In the site's navigation");
  return [...picked.values()];
}

/** True when a URL belongs to the business's website (its registrable domain or a listed alias). */
export function onSite(url: string, siteDomains: readonly string[]): boolean {
  const key = pageKeyOf(url);
  if (!key) return false;
  const site = siteKeyOf(key);
  return siteDomains.some((d) => site === siteKeyOf(d) || key.split("/")[0] === d || key.split("/")[0]!.endsWith("." + d));
}
