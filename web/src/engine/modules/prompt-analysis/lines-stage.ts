import { z } from "zod";
import type { JsonValue, StageDefinition } from "../../types";

/**
 * pa_lines: the business's service lines (e.g. car rental, villas, yachts) and which questions belong to each. Owner
 * decision (19 Nov 2026): lines with different services have different sites and competitors, so each gets its own
 * citation map. A question can belong to several lines (a car + villa + yacht package question counts in all three).
 *
 * Kept apart from the prompt set so tagging questions never means asking the AIs again: saving lines queues this
 * stage with the lines as params; the web presence stages read it. It reads no other stage, so approving a new prompt
 * set doesn't make it stale and hold up the web presence stages; the form checks ids against the latest set, and
 * wp_pages ignores ids that aren't in the set it uses.
 */
export const LINES_VERSION = "2026-11-19";
/** Owner decision (19 Nov 2026): a line with fewer questions than this gets no citation map (too few answers). */
export const MIN_LINE_QUESTIONS = 3;

const text = z.string().trim().min(1);
export const serviceLines = z
  .object({
    lines: z
      .array(z.object({ name: text.max(60), questions: z.array(z.string().regex(/^P\d+$/)).min(1) }).strict())
      .max(10),
  })
  .strict()
  .superRefine((s, ctx) => {
    const names = new Set<string>();
    s.lines.forEach((l, i) => {
      const k = l.name.toLowerCase();
      if (names.has(k)) ctx.addIssue({ code: "custom", message: `Line "${l.name}" is listed twice`, path: ["lines", i] });
      names.add(k);
      if (new Set(l.questions).size !== l.questions.length) ctx.addIssue({ code: "custom", message: `Line "${l.name}" lists a question twice`, path: ["lines", i] });
    });
  });
export type ServiceLines = z.infer<typeof serviceLines>;

/** Lines that get a citation map: at least MIN_LINE_QUESTIONS questions. */
export const shownLines = (s: ServiceLines) => s.lines.filter((l) => l.questions.length >= MIN_LINE_QUESTIONS);

export const paLines: StageDefinition = {
  id: "pa_lines",
  module: "prompt-analysis",
  label: "Prompt analysis: service lines (which questions belong to each line)",
  inputs: [],
  timeoutMs: 10_000,
  maxAttempts: 1,
  parseParams: (raw) => serviceLines.parse(raw) as unknown as Record<string, JsonValue>,
  output: serviceLines,
  async run(ctx) {
    const lines = serviceLines.parse(ctx.params);
    return { status: "done", output: lines as unknown as JsonValue };
  },
};
