/**
 * The JavaScript check (report-tech-requirements.md §3.2): compare the visible text of our plain fetch (what a reader
 * that doesn't run scripts gets) with the same page loaded in our headless browser. Plain code, no model.
 * Our diagnostic only: it explains a reading result, it never is one.
 */
export const JS_CHECK_VERSION = "2026-11-17";

export type JsVerdict = "key_facts_need_js" | "content_needs_js" | "minor" | "same" | "not_checked";
export type KeyFact = { kind: "price" | "phone" | "hours"; text: string; line: string };

/** Content counts as needing JavaScript from this much text that only the browser saw. */
const CONTENT_MIN_WORDS = 80;
const CONTENT_MIN_SHARE = 0.25;
const MAX_LINES_KEPT = 25;
const MAX_FACTS_KEPT = 15;

const norm = (s: string) => s.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^\p{L}\p{N}$]+/gu, " ").trim();
const words = (s: string) => (s.trim() ? s.trim().split(/\s+/).length : 0);

const PATTERNS: { kind: KeyFact["kind"]; re: RegExp }[] = [
  { kind: "price", re: /(?:US)?\$\s?\d[\d,]*(?:\.\d{2})?(?:\s?(?:\/|per)\s?(?:day|night|hour|hr|week|month|person|guest))?/gi },
  { kind: "phone", re: /(?:\+?1[\s.-]?)?\(?\b\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}\b/g },
  { kind: "hours", re: /\b\d{1,2}(?::\d{2})?\s?(?:am|pm|a\.m\.|p\.m\.)\s?(?:-|–|to)\s?\d{1,2}(?::\d{2})?\s?(?:am|pm|a\.m\.|p\.m\.)/gi },
];

export function keyFacts(lines: readonly string[]): KeyFact[] {
  const out: KeyFact[] = [];
  for (const line of lines)
    for (const { kind, re } of PATTERNS)
      for (const m of line.matchAll(re)) out.push({ kind, text: m[0].trim(), line: line.slice(0, 200) });
  return out;
}

export type JsComparison = {
  verdict: JsVerdict;
  reason: string;
  rawWords: number;
  renderedWords: number;
  /** Words in lines only the browser saw. */
  addedWords: number;
  /** Words in lines only the plain fetch saw (scripts removed or replaced them). */
  removedWords: number;
  /** A sample of the lines only the browser saw, in page order. */
  onlyRendered: string[];
  /** Prices, phone numbers and opening hours that appear only after scripts ran. */
  keyFactsOnlyRendered: KeyFact[];
};

/**
 * Lines of the rendered text that the raw text doesn't contain (compared as letters, digits and $, ignoring case and
 * spacing; a line counts as present when it appears anywhere in the raw text, so re-wrapped text isn't "new").
 */
export function compareTexts(raw: string, rendered: string): JsComparison {
  const rawNorm = ` ${norm(raw.replace(/\n/g, " "))} `;
  const renderedNorm = ` ${norm(rendered.replace(/\n/g, " "))} `;
  const lines = (t: string) => t.split("\n").map((l) => l.trim()).filter(Boolean);
  const onlyRendered = [...new Set(lines(rendered).filter((l) => norm(l) && !rawNorm.includes(` ${norm(l)} `)))];
  const onlyRaw = lines(raw).filter((l) => norm(l) && !renderedNorm.includes(` ${norm(l)} `));
  const addedWords = onlyRendered.reduce((n, l) => n + words(l), 0);
  const removedWords = onlyRaw.reduce((n, l) => n + words(l), 0);
  const rawWords = words(raw);
  const renderedWords = words(rendered);

  // A fact is new only when its value isn't anywhere in the raw text (the same price shown again isn't new).
  const facts = keyFacts(onlyRendered).filter((f) => !rawNorm.includes(` ${norm(f.text)} `));
  const seen = new Set<string>();
  const uniqueFacts = facts.filter((f) => !seen.has(`${f.kind}:${norm(f.text)}`) && seen.add(`${f.kind}:${norm(f.text)}`));

  const base = { rawWords, renderedWords, addedWords, removedWords, onlyRendered: onlyRendered.slice(0, MAX_LINES_KEPT), keyFactsOnlyRendered: uniqueFacts.slice(0, MAX_FACTS_KEPT) };
  const kinds = [...new Set(uniqueFacts.map((f) => ({ price: "prices", phone: "phone numbers", hours: "opening hours" })[f.kind]))];
  if (uniqueFacts.length)
    return { ...base, verdict: "key_facts_need_js", reason: `${capitalize(list(kinds))} appear only after scripts run (${uniqueFacts.length} found, e.g. ${uniqueFacts[0]!.text}).` };
  if (addedWords >= CONTENT_MIN_WORDS && addedWords >= CONTENT_MIN_SHARE * Math.max(renderedWords, 1))
    return { ...base, verdict: "content_needs_js", reason: `${addedWords} of ${renderedWords} words appear only after scripts run.` };
  if (addedWords > 0) return { ...base, verdict: "minor", reason: `A little text (${addedWords} words) appears only after scripts run; the main content is in the page itself.` };
  return { ...base, verdict: "same", reason: "The page's text is the same with and without scripts." };
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const list = (xs: readonly string[]) => (xs.length <= 1 ? (xs[0] ?? "") : `${xs.slice(0, -1).join(", ")} and ${xs.at(-1)}`);

/** Plain-English label for the website pages screen and, later, the report. */
export function verdictLabel(v: JsVerdict): string {
  return {
    key_facts_need_js: "Key facts load with JavaScript: likely invisible to ChatGPT and Claude",
    content_needs_js: "Much of the content loads with JavaScript: likely invisible to ChatGPT and Claude",
    minor: "Mostly readable without JavaScript",
    same: "Readable without JavaScript",
    not_checked: "Couldn't check",
  }[v];
}
