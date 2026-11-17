import type { ReadAttempt } from "../../../answers";
import { pageKeyOf } from "../../prompt-analysis/logic/sources";

/**
 * Can each AI find and read the selected pages (website-discovery-accessibility.md §6–8)? The prompts, URL matching
 * and outcomes are plain code; the model's own claims never decide an outcome without tool evidence.
 */
export const TEST_TEMPLATE_VERSION = "2026-11-17.2";
/** Facts asked for in the reading test, at most this many per page. */
export const MAX_FACTS = 40;

export type SearchStatus = "found" | "not_found" | "unconfirmed" | "not_tested";
export type ReadStatus = "readable" | "partial" | "unsuccessful" | "unconfirmed" | "not_tested";

/** "FAQ's For Renting Exotic & Luxury Vehicles | MVP Miami Rentals" -> "FAQ's For Renting Exotic & Luxury Vehicles". */
export function pagePurpose(page: { kind: string; title: string | null; reason: string }): string {
  const t = (page.title ?? "").split(/\s+[|–—-]\s+/)[0]!.trim();
  if (t && page.kind !== "home") return t;
  const byKind: Record<string, string> = { home: "home page", contact: "contact information", booking: "booking or quotes", faq: "frequently asked questions", pricing: "prices", policy: "rental terms and policies", about: "about the business", location: "locations" };
  return byKind[page.kind] ?? page.reason;
}

/** Branded navigational search prompt (§6). It never contains the target URL or our page text. */
export function searchPrompt(business: { name: string; location: string }, page: { kind: string; title: string | null; reason: string }): string {
  if (page.kind === "home") return `Find the official website of ${business.name} (${business.location}). Return the official page and the sources used.`;
  return `Find the official ${business.name} (${business.location}) page about "${pagePurpose(page)}". Return the relevant official page and the sources used.`;
}

/**
 * Reading instruction (§7): open the page, prove it with two passages, then list the key facts a customer would look
 * for. No expected facts or passages are given; the facts are scored afterwards against what a visitor sees.
 */
export function readInstruction(url: string): string {
  return [
    `Open this official page: ${url}`,
    `Report the page title and two short passages copied word for word from its main content, in exactly this format:`,
    `TITLE: <the page title>`,
    `PASSAGE 1: "<words from the page>"`,
    `PASSAGE 2: "<words from the page>"`,
    `Then list the key facts a customer would look for that this page states: prices, phone numbers, opening hours, and the products or services offered by name. One per line, at most ${MAX_FACTS}, written as on the page:`,
    `FACT: price | <price as written, with what it is for>`,
    `FACT: phone | <phone number>`,
    `FACT: hours | <opening hours>`,
    `FACT: item | <product or service name>`,
    `If the page states none of these, write: FACTS: none`,
    `If your tool cannot retrieve the page, reply only: COULD NOT OPEN: <reason>`,
    `Do not answer from general knowledge or other pages.`,
  ].join("\n");
}

/** Page keys that identify the target: the approved URL, where it redirected, and its canonical URL. */
export function targetKeys(urls: readonly (string | null | undefined)[]): Set<string> {
  return new Set(urls.flatMap((u) => (u ? [pageKeyOf(u)] : [])).filter((k): k is string => !!k));
}

export function matches(url: string, keys: ReadonlySet<string>): boolean {
  const k = pageKeyOf(url);
  return !!k && keys.has(k);
}

export function searchOutcome(r: { sources: readonly string[]; citations: readonly string[]; searchQueries: readonly string[] }, keys: ReadonlySet<string>): { status: SearchStatus; how: "cited" | "result" | null; matchedUrl: string | null; reason: string } {
  const cited = r.citations.find((u) => matches(u, keys));
  if (cited) return { status: "found", how: "cited", matchedUrl: cited, reason: "The page was cited in the answer." };
  const result = r.sources.find((u) => matches(u, keys));
  if (result) return { status: "found", how: "result", matchedUrl: result, reason: "The page was among the search results but not cited." };
  if (!r.searchQueries.length && !r.sources.length && !r.citations.length) return { status: "unconfirmed", how: null, matchedUrl: null, reason: "No search was observed, so this test says nothing about discovery." };
  return { status: "not_found", how: null, matchedUrl: null, reason: "Search ran but neither its results nor the answer included this page." };
}

export type FactKind = "price" | "phone" | "hours" | "item";
export type ReportedFact = { kind: FactKind; text: string };
export type ParsedReply = { couldNotOpen: string | null; title: string | null; passages: string[]; facts: ReportedFact[] };

export function parseReadReply(text: string): ParsedReply {
  const cno = /COULD NOT OPEN:\s*(.+)/i.exec(text);
  const title = /TITLE:\s*(.+)/i.exec(text)?.[1]?.trim() ?? null;
  const passages = [...text.matchAll(/PASSAGE\s*\d\s*:\s*["“]?(.+?)["”]?\s*$/gim)].map((m) => m[1]!.trim()).filter(Boolean);
  const facts = [...text.matchAll(/^\s*[-*]?\s*FACT\s*:\s*(price|phone|hours|item)s?\s*[|:–-]\s*(.+?)\s*$/gim)]
    .map((m) => ({ kind: m[1]!.toLowerCase() as FactKind, text: m[2]!.replace(/^["“]|["”]$/g, "").trim() }))
    .filter((f) => f.text)
    .slice(0, MAX_FACTS);
  return { couldNotOpen: cno ? cno[1]!.trim() : null, title, passages, facts };
}

const norm = (s: string) => s.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();

/** A passage counts only when it has at least 5 words and appears, word for word (letters and digits), in a reference. */
export function verifiedPassages(passages: readonly string[], references: readonly (string | null)[]): boolean[] {
  const refs = references.filter((r): r is string => !!r).map(norm);
  return passages.map((p) => {
    const n = norm(p.replace(/\.{3}|…/g, " "));
    return n.split(" ").length >= 5 && refs.some((r) => r.includes(n));
  });
}

/**
 * Reading outcome (§7): needs the tool's own attempt on this page. Readable = two passages found on the page (in our
 * snapshot or in the content the tool returned); partly read = one; an attempt that failed = unsuccessful; no tool
 * attempt, or no passage that can be checked = unconfirmed. A model saying it read the page proves nothing.
 */
export function readOutcome(attempts: readonly ReadAttempt[], reply: ParsedReply, verified: readonly boolean[], keys: ReadonlySet<string>): { status: ReadStatus; reason: string } {
  const mine = attempts.filter((a) => matches(a.url, keys));
  if (!mine.length) return { status: "unconfirmed", reason: attempts.length ? "The tool opened other pages, not this one." : "No page-reading tool activity was observed." };
  const ok = mine.filter((a) => a.status !== "error");
  if (!ok.length) return { status: "unsuccessful", reason: `The tool's attempt failed: ${mine.map((a) => a.detail ?? "error").join(", ")}` };
  const n = verified.filter(Boolean).length;
  if (n >= 2) return { status: "readable", reason: `${n} passages it returned are on the page.` };
  if (n === 1) return { status: "partial", reason: "Only one passage it returned is on the page." };
  if (reply.couldNotOpen) return { status: "unsuccessful", reason: `It reported it could not open the page: ${reply.couldNotOpen}` };
  return { status: "unconfirmed", reason: "The tool opened the page, but none of the passages it returned could be found on it." };
}

// ---------------------------------------------------------------------------------------------------------------
// Key-fact extraction score: what the AI listed vs what a visitor sees (the answer key from ws_render)
// ---------------------------------------------------------------------------------------------------------------

export type KeyFactRef = { kind: "price" | "phone" | "hours"; text: string; jsOnly: boolean };
export type ExtractionScore = {
  got: number;
  of: number;
  /** Key facts it missed (a sample), and how many of all misses load only with JavaScript. */
  missed: KeyFactRef[];
  missedJsOnly: number;
  /** Products or services it named that we could find in the visitor's text, out of those it named. */
  itemsOnPage: number;
  itemsNamed: number;
};

const digits = (s: string) => s.replace(/\D/g, "");
/** "$1,495.00/day" -> "1495"; "US$3,500 per hour" -> "3500". */
export function priceValue(s: string): string | null {
  const m = /\d[\d,]*(?:\.\d{1,2})?/.exec(s);
  if (!m) return null;
  const [whole, cents] = m[0].replace(/,/g, "").split(".");
  return cents && Number(cents) ? `${whole}.${cents.padEnd(2, "0")}` : whole!;
}
/** The last ten digits of a US number. */
export const phoneValue = (s: string) => digits(s).slice(-10);
/** "9am - 6pm" / "9:00 AM to 6:00 PM" -> "9-18" (hours only, 24-hour). */
export function hoursValue(s: string): string | null {
  const times = [...s.toLowerCase().matchAll(/(\d{1,2})(?::(\d{2}))?\s?(a\.?m\.?|p\.?m\.?)/g)].map((m) => {
    let h = Number(m[1]) % 12;
    if (m[3]!.startsWith("p")) h += 12;
    return `${h}${m[2] && m[2] !== "00" ? `:${m[2]}` : ""}`;
  });
  return times.length >= 2 ? `${times[0]}-${times[1]}` : null;
}
function factValue(kind: KeyFactRef["kind"], text: string): string | null {
  return kind === "price" ? priceValue(text) : kind === "phone" ? (phoneValue(text).length === 10 ? phoneValue(text) : null) : hoursValue(text);
}

/** Answer-key facts, one per distinct value (the same price shown twice counts once). */
export function uniqueKeyFacts(facts: readonly KeyFactRef[]): KeyFactRef[] {
  const seen = new Map<string, KeyFactRef>();
  for (const f of facts) {
    const v = factValue(f.kind, f.text);
    if (!v) continue;
    const k = `${f.kind}:${v}`;
    const prev = seen.get(k);
    if (!prev) seen.set(k, f);
    else if (!f.jsOnly && prev.jsOnly) seen.set(k, f); // shown without scripts somewhere: not JS-only
  }
  return [...seen.values()];
}

const loose = (s: string) => s.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();

/**
 * Scores the facts an AI listed against the visitor's key facts: a key fact counts as got when any listed fact has the
 * same value (prices by amount, phones by number, hours by times), whatever kind the AI gave it. Items can't be listed
 * reliably from a page by rule, so they're checked the other way: how many names it gave appear in the visitor's text.
 */
export function scoreExtraction(key: readonly KeyFactRef[], reported: readonly ReportedFact[], visitorText: string | null): ExtractionScore {
  const facts = uniqueKeyFacts(key);
  const values = { price: new Set<string>(), phone: new Set<string>(), hours: new Set<string>() };
  for (const r of reported) {
    for (const m of r.text.matchAll(/\d[\d,]*(?:\.\d{1,2})?/g)) {
      const v = priceValue(m[0]);
      if (v) values.price.add(v);
    }
    const p = phoneValue(r.text);
    if (p.length === 10) values.phone.add(p);
    const h = hoursValue(r.text);
    if (h) values.hours.add(h);
  }
  const missed = facts.filter((f) => !values[f.kind].has(factValue(f.kind, f.text)!));
  const items = reported.filter((r) => r.kind === "item");
  const page = visitorText ? ` ${loose(visitorText)} ` : null;
  return {
    got: facts.length - missed.length,
    of: facts.length,
    missed: missed.slice(0, 10),
    missedJsOnly: missed.filter((f) => f.jsOnly).length,
    itemsOnPage: page ? items.filter((i) => loose(i.text) && page.includes(` ${loose(i.text)} `)).length : 0,
    itemsNamed: items.length,
  };
}
