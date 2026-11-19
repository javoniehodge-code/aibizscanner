import { z } from "zod";
import { citationCoverageSection, evidenceEntry } from "@/report/schema";
import type { JsonValue, StageContext, StageDefinition } from "../../types";
import { buildCitationCoverage, citedPagesEvidence } from "./logic/section";
import { citedPages } from "./schemas";

/** wp_section: the report's web presence parts built so far, with their evidence (read by report_assemble). */
export const webPresenceSection = z
  .object({
    citationCoverage: citationCoverageSection,
    evidence: z.record(z.string(), evidenceEntry),
  })
  .strict();
export type WebPresenceSection = z.infer<typeof webPresenceSection>;

function input<T>(ctx: StageContext, stage: string, schema: z.ZodType<T>) {
  const i = ctx.inputs[stage];
  if (!i) throw new Error(`Missing input ${stage}`);
  return { ...schema.parse(i.output), runId: i.runId, finishedAt: i.finishedAt ?? new Date().toISOString() };
}

export const wpSection: StageDefinition = {
  id: "wp_section",
  module: "web-presence",
  label: "Web presence 2/2: build the report's web presence parts",
  inputs: ["wp_pages"],
  timeoutMs: 20_000,
  maxAttempts: 1,
  autoRun: true,
  parseParams: () => ({}),
  output: webPresenceSection,
  async run(ctx) {
    const cp = input(ctx, "wp_pages", citedPages);
    const out: WebPresenceSection = { citationCoverage: buildCitationCoverage(cp), evidence: citedPagesEvidence(cp) };
    return { status: "done", output: out as unknown as JsonValue };
  },
};
