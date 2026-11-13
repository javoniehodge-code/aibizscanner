import type { AnswerExtraction, StoredAnswer } from "../schemas";
import { PageRegistry, type CitedPage } from "./citations";
import { matchBusiness, newBusinessKey, type KnownBusiness } from "./names";

/** A prompt from the approved prompt set. */
export type Prompt = { id: string; group: number; demand: string; text: string };

export type AssembledAnswer =
  | {
      status: "ok";
      named: { business: string; status: "R" | "M" | "X" }[];
      citations: string[];
      uncitedMentions: { source: string; text: string; page: string | null }[];
      text: string;
      statedReason: string | null;
      grouped: boolean;
      searchObserved: boolean;
      runAt: string;
      /** The engine_answer row this came from (becomes the evidence id in the report). */
      answerId: string;
    }
  | { status: "unavailable"; reason: string; runAt: string; answerId: string };

export type AssembledPromptAnalysis = {
  businesses: KnownBusiness[];
  pages: CitedPage[];
  questions: { prompt: Prompt; answers: [AssembledAnswer, AssembledAnswer, AssembledAnswer] }[];
  firstChoices: { prompt: string; engine: number; business: string; scope: string; excerpt: string; answerId: string }[];
  run: { prompts: number; expected: number; usable: number; unavailable: number; gaps: string };
};

const ENGINES = ["ChatGPT", "Claude", "Gemini"];
const STATUS = { recommended: "R", mentioned: "M", excluded: "X" } as const;

/** "2026-11-13T14:05:00Z" -> "13 Nov 2026, 14:05 UTC". */
export function formatRunAt(iso: string | null): string {
  if (!iso) return "time not recorded";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "time not recorded";
  const month = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][d.getUTCMonth()];
  return `${d.getUTCDate()} ${month} ${d.getUTCFullYear()}, ${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")} UTC`;
}

/**
 * Deterministic assembly of the prompt-analysis data from stored answers and their verified extractions.
 * Every usable answer must have an extraction (the caller guarantees quotes were verified). Business keys are stable for
 * the target and assigned in order of first appearance for others; pages are keyed in order of first citation.
 */
export function assemblePromptAnalysis(input: {
  prompts: readonly Prompt[];
  answers: readonly StoredAnswer[];
  extractions: ReadonlyMap<string, AnswerExtraction>;
  target: KnownBusiness;
  ownDomains: readonly string[];
}): AssembledPromptAnalysis {
  const known: KnownBusiness[] = [input.target];
  const taken = new Set([input.target.key]);
  const keyOf = (name: string) => {
    const k = matchBusiness(name, known);
    if (k) return k;
    const key = newBusinessKey(name, taken);
    taken.add(key);
    known.push({ key, name });
    return key;
  };
  const pages = new PageRegistry(input.ownDomains, []);
  const firstChoices: AssembledPromptAnalysis["firstChoices"] = [];

  const questions = input.prompts.map((prompt) => {
    const answers = [0, 1, 2].map((engine): AssembledAnswer => {
      const a = input.answers.find((x) => x.promptId === prompt.id && x.engine === engine);
      if (!a) return { status: "unavailable", reason: "No answer was collected", runAt: "not run", answerId: "" };
      const runAt = formatRunAt(a.respondedAt);
      if (a.status !== "ok" || !a.text) {
        return { status: "unavailable", reason: a.error ?? (a.status === "ok" ? "Empty answer" : `Answer ${a.status}`), runAt, answerId: a.answerId };
      }
      const ex = input.extractions.get(a.answerId);
      if (!ex) throw new Error(`No verified extraction for answer ${a.answerId} (${prompt.id}, ${ENGINES[engine]})`);
      const named: { business: string; status: "R" | "M" | "X" }[] = [];
      let statedReason: string | null = null;
      for (const b of ex.businesses) {
        const key = keyOf(b.name);
        if (named.some((n) => n.business === key)) continue; // each business counts once per answer
        named.push({ business: key, status: STATUS[b.status] });
        if (key === input.target.key && b.reason) statedReason = b.reason;
      }
      if (ex.firstChoice) {
        firstChoices.push({ prompt: prompt.id, engine, business: keyOf(ex.firstChoice.name), scope: ex.firstChoice.scope, excerpt: ex.firstChoice.quote, answerId: a.answerId });
      }
      const citations = [...new Set(a.citations.map((u) => pages.keyFor(u)).filter((k): k is string => k !== null))];
      return {
        status: "ok",
        named,
        citations,
        uncitedMentions: ex.namedSources.map((n) => ({ source: n.source, text: n.quote, page: null })),
        text: a.text,
        statedReason,
        grouped: ex.grouped,
        searchObserved: a.searchObserved,
        runAt,
        answerId: a.answerId,
      };
    }) as [AssembledAnswer, AssembledAnswer, AssembledAnswer];
    return { prompt, answers };
  });

  const all = questions.flatMap((q) => q.answers.map((a, engine) => ({ a, engine, prompt: q.prompt.id })));
  const gaps = all.filter((x) => x.a.status !== "ok").map((x) => `${ENGINES[x.engine]}, ${x.prompt}`);
  return {
    businesses: known,
    pages: pages.pages(),
    questions,
    firstChoices,
    run: { prompts: questions.length, expected: all.length, usable: all.length - gaps.length, unavailable: gaps.length, gaps: gaps.join("; ") },
  };
}
