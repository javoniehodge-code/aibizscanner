import { normalizeName } from "../logic/names";
import type { AnswerExtraction } from "../schemas";

/**
 * Accuracy scoring for prompt-analysis/extract-answer: compares a model's extraction with a human-verified expected
 * extraction (an eval_case). Plain code, so the score itself is testable. Quotes aren't compared (wording may differ);
 * they are verified against the answer separately.
 */
export type ExtractionScore = {
  passed: boolean;
  missed: string[];
  extra: string[];
  statusMismatches: { name: string; expected: string; actual: string }[];
  orderCorrect: boolean;
  groupedCorrect: boolean;
  firstChoiceCorrect: boolean;
  namedSourcesMissed: string[];
};

export function scoreExtraction(expected: AnswerExtraction, actual: AnswerExtraction): ExtractionScore {
  const exp = new Map(expected.businesses.map((b) => [normalizeName(b.name), b]));
  const act = new Map(actual.businesses.map((b) => [normalizeName(b.name), b]));
  const missed = [...exp.keys()].filter((k) => !act.has(k)).map((k) => exp.get(k)!.name);
  const extra = [...act.keys()].filter((k) => !exp.has(k)).map((k) => act.get(k)!.name);
  const statusMismatches = [...exp.entries()]
    .filter(([k, b]) => act.has(k) && act.get(k)!.status !== b.status)
    .map(([k, b]) => ({ name: b.name, expected: b.status, actual: act.get(k)!.status }));
  const common = (list: AnswerExtraction["businesses"], other: Map<string, unknown>) => list.map((b) => normalizeName(b.name)).filter((k) => other.has(k));
  const orderCorrect = expected.grouped || JSON.stringify(common(expected.businesses, act)) === JSON.stringify(common(actual.businesses, exp));
  const groupedCorrect = expected.grouped === actual.grouped;
  const fc = (x: AnswerExtraction) => (x.firstChoice ? normalizeName(x.firstChoice.name) : null);
  const firstChoiceCorrect = fc(expected) === fc(actual);
  const actualSources = new Set(actual.namedSources.map((s) => normalizeName(s.source)));
  const namedSourcesMissed = expected.namedSources.map((s) => s.source).filter((s) => !actualSources.has(normalizeName(s)));
  const passed = !missed.length && !extra.length && !statusMismatches.length && orderCorrect && groupedCorrect && firstChoiceCorrect && !namedSourcesMissed.length;
  return { passed, missed, extra, statusMismatches, orderCorrect, groupedCorrect, firstChoiceCorrect, namedSourcesMissed };
}
