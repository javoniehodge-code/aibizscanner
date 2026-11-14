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
