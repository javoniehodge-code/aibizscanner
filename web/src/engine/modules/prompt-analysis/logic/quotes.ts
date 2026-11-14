import type { AnswerExtraction } from "../schemas";

/**
 * Normalizes text for quote matching. Engines answer in Markdown with inline source links; the reading model quotes
 * the words as a person reads them. So formatting is removed on both sides: links become their text, source tags like
 * "(mvpmiami.com)" are dropped, emphasis, heading marks and table dividers go. Then curly quotes, dashes, ellipses, spacing and case.
 * Only formatting is ignored: every word of a quote must still appear, in order, in the answer.
 */
export function normalizeText(s: string): string {
  return s
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1") // [text](url) -> text
    .replace(/\(\s*(?:https?:\/\/)?(?:www\.)?[a-z0-9-]+(?:\.[a-z0-9-]+)+(?:\/[^\s)]*)?\s*\)/gi, " ") // (example.com)
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/[*`]+|(^|\s)_+|_+(?=\s|$|[.,;:!?])/g, "$1")
    .replace(/^\s*#{1,6}\s+/gm, "")
    .replace(/^\s*\|?(?:\s*:?-{2,}:?\s*\|)+\s*:?-*:?\s*$/gm, " ") // table separator rows |---|---|
    .replace(/\|/g, " ") // table cell dividers
    .replace(/\s+([.,;:!?])/g, "$1")
    .replace(/[‘’‛′]/g, "'")
    .replace(/[“”‟″]/g, '"')
    .replace(/[‐-―−]/g, "-")
    .replace(/…/g, "...")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/**
 * Every quote the LLM returns must appear in the answer. A quote that doesn't is a hallucination or a paraphrase: the
 * claim it supports can't be verified from stored evidence, so the extraction is rejected (brief §3.8: never invent).
 * Returns the problems (empty when every quote is found).
 */
export function unverifiedQuotes(extraction: AnswerExtraction, answerText: string): string[] {
  const hay = normalizeText(answerText);
  const found = (q: string) => hay.includes(normalizeText(q));
  const problems: string[] = [];
  extraction.businesses.forEach((b, i) => {
    if (!found(b.quote)) problems.push(`businesses[${i}] (${b.name}): quote not in the answer: "${b.quote}"`);
    if (b.reason && !found(b.reason)) problems.push(`businesses[${i}] (${b.name}): reason not in the answer: "${b.reason}"`);
    if (!found(b.name)) problems.push(`businesses[${i}]: name "${b.name}" not in the answer`);
  });
  if (extraction.firstChoice && !found(extraction.firstChoice.quote)) {
    problems.push(`firstChoice: quote not in the answer: "${extraction.firstChoice.quote}"`);
  }
  extraction.namedSources.forEach((n, i) => {
    if (!found(n.quote)) problems.push(`namedSources[${i}] (${n.source}): quote not in the answer: "${n.quote}"`);
  });
  return problems;
}

export type VerifiedExtraction = {
  /** The extraction with every unverifiable optional detail removed. */
  extraction: AnswerExtraction;
  /** Optional details removed because their words aren't in the answer (kept for the record). */
  dropped: string[];
  /** Problems that make the extraction unusable: a business's name or status quote isn't in the answer. */
  problems: string[];
};

/**
 * Checks an extraction against the answer. Names and status quotes are the evidence for who was named and how, so if
 * one isn't in the answer the extraction is rejected. Optional details (a reason, a first choice, a named source) that
 * aren't in the answer are dropped instead: the answer stays usable and nothing unverified is reported.
 */
export function verifyExtraction(extraction: AnswerExtraction, answerText: string): VerifiedExtraction {
  const hay = normalizeText(answerText);
  const found = (q: string) => hay.includes(normalizeText(q));
  const problems: string[] = [];
  const dropped: string[] = [];
  const businesses = extraction.businesses.map((b, i) => {
    if (!found(b.name)) problems.push(`businesses[${i}]: name "${b.name}" not in the answer`);
    if (!found(b.quote)) problems.push(`businesses[${i}] (${b.name}): quote not in the answer: "${b.quote}"`);
    if (b.reason && !found(b.reason)) {
      dropped.push(`businesses[${i}] (${b.name}): reason not in the answer: "${b.reason}"`);
      return { ...b, reason: null };
    }
    return b;
  });
  let firstChoice = extraction.firstChoice;
  if (firstChoice && !found(firstChoice.quote)) {
    dropped.push(`firstChoice (${firstChoice.name}): quote not in the answer: "${firstChoice.quote}"`);
    firstChoice = null;
  }
  const namedSources = extraction.namedSources.filter((n, i) => {
    if (found(n.quote)) return true;
    dropped.push(`namedSources[${i}] (${n.source}): quote not in the answer: "${n.quote}"`);
    return false;
  });
  return { extraction: { ...extraction, businesses, firstChoice, namedSources }, dropped, problems };
}
