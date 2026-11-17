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

/**
 * The answer key for the extraction test: the prices, phone numbers and hours a visitor sees (the browser's text, or
 * our plain text when the browser couldn't load the page), each marked jsOnly when its value isn't in the plain text.
 */
export function visitorKeyFacts(visitorText: string, plainText: string | null): { kind: KeyFact["kind"]; text: string; jsOnly: boolean }[] {
  const lines = (t: string) => t.split("\n").map((l) => l.trim()).filter(Boolean);
  const plain = plainText === null ? null : keyFacts(lines(plainText)).map((f) => `${f.kind}:${valueOf(f)}`);
  const out = new Map<string, { kind: KeyFact["kind"]; text: string; jsOnly: boolean }>();
  for (const f of keyFacts(lines(visitorText))) {
    const k = `${f.kind}:${valueOf(f)}`;
    if (!out.has(k)) out.set(k, { kind: f.kind, text: f.text, jsOnly: plain !== null && !plain.includes(k) });
  }
  return [...out.values()].slice(0, MAX_KEY_FACTS);
}
const valueOf = (f: { text: string }) => f.text.replace(/[^0-9apm]/gi, "").toLowerCase();
const MAX_KEY_FACTS = 60;

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

/**
 * What to tell the business when key facts depend on JavaScript (owner's wording, 17 Nov 2026).
 */
export function recommendationFor(verdict: JsVerdict, facts: readonly Pick<KeyFact, "kind">[]): string | null {
  if (verdict === "content_needs_js")
    return "Much of this page's content depends on JavaScript. Making it available immediately removes one potential barrier to reading it.";
  if (verdict !== "key_facts_need_js") return null;
  const kinds = [...new Set(facts.map((f) => ({ price: "prices", phone: "phone numbers", hours: "opening hours" })[f.kind]))];
  return `Your ${list(kinds)} depend on JavaScript. Making them available immediately removes one potential barrier to reading them.`;
}

/** Plain-English label for the website pages screen and, later, the report. */
export function verdictLabel(v: JsVerdict): string {
  return {
    key_facts_need_js: "Key facts load with JavaScript",
    content_needs_js: "Much of the content loads with JavaScript",
    minor: "Mostly readable without JavaScript",
    same: "Readable without JavaScript",
    not_checked: "Couldn't check",
  }[v];
}
