import { serviceLines, type ServiceLines } from "@/engine/modules/prompt-analysis/lines-stage";

/** Service lines as the prompts page shows them: one per line, `Name | P1, P2, P5`. */
export function formatServiceLines(s: ServiceLines | null): string {
  return (s?.lines ?? []).map((l) => `${l.name} | ${l.questions.join(", ")}`).join("\n");
}

export type LinesParse = { ok: true; value: ServiceLines } | { ok: false; errors: string[] };

/** Parses the form text. Question ids are checked against the prompt set when the pa_lines stage runs. */
export function parseServiceLines(text: string, knownIds?: readonly string[]): LinesParse {
  const errors: string[] = [];
  const lines: ServiceLines["lines"] = [];
  text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .forEach((row, i) => {
      const [name, ids, ...rest] = row.split("|").map((x) => x.trim());
      if (!name || ids === undefined || rest.length) return void errors.push(`Line ${i + 1}: write it as "Name | P1, P2, P5".`);
      const questions = ids
        .split(/[,\s]+/)
        .filter(Boolean)
        .map((q) => q.toUpperCase());
      const bad = questions.filter((q) => !/^P\d+$/.test(q) || (knownIds && !knownIds.includes(q)));
      if (!questions.length) return void errors.push(`Line ${i + 1} (${name}): list at least one question.`);
      if (bad.length) return void errors.push(`Line ${i + 1} (${name}): ${bad.join(", ")} ${bad.length === 1 ? "isn't a question" : "aren't questions"} in the prompt set.`);
      lines.push({ name, questions: [...new Set(questions)] });
    });
  if (errors.length) return { ok: false, errors };
  const parsed = serviceLines.safeParse({ lines });
  return parsed.success ? { ok: true, value: parsed.data } : { ok: false, errors: parsed.error.issues.map((e) => e.message) };
}
