import type { ReadAttempt } from "../../../answers";
import { pageKeyOf } from "../../prompt-analysis/logic/sources";

/**
 * Can each AI find and read the selected pages (website-discovery-accessibility.md §6–8)? The prompts, URL matching
 * and outcomes are plain code; the model's own claims never decide an outcome without tool evidence.
 */
export const TEST_TEMPLATE_VERSION = "2026-11-17";

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

/** Reading instruction (§7). No expected facts or passages are given. */
export function readInstruction(url: string): string {
  return [
    `Open this official page: ${url}`,
    `Report the page title and two short passages copied word for word from its main content, in exactly this format:`,
    `TITLE: <the page title>`,
    `PASSAGE 1: "<words from the page>"`,
    `PASSAGE 2: "<words from the page>"`,
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

export type ParsedReply = { couldNotOpen: string | null; title: string | null; passages: string[] };

export function parseReadReply(text: string): ParsedReply {
  const cno = /COULD NOT OPEN:\s*(.+)/i.exec(text);
  const title = /TITLE:\s*(.+)/i.exec(text)?.[1]?.trim() ?? null;
  const passages = [...text.matchAll(/PASSAGE\s*\d\s*:\s*["“]?(.+?)["”]?\s*$/gim)].map((m) => m[1]!.trim()).filter(Boolean);
  return { couldNotOpen: cno ? cno[1]!.trim() : null, title, passages };
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
