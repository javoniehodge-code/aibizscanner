import { z } from "zod";
import { citationCoverageSection, copyEntry, credibleSection, evidenceEntry, webPresenceRows } from "@/report/schema";
import type { JsonValue, StageContext, StageDefinition } from "../../types";
import { assembledSection } from "../prompt-analysis/stages";
import { assessedEvidence, buildCredible, buildWebPresence, credibleCopy } from "./logic/credible";
import { buildCitationCoverage, citedPagesEvidence } from "./logic/section";
import { assessedPages, citedPages } from "./schemas";

/** wp_section: the report's web presence parts built so far, with their evidence and copy (read by report_assemble). */
export const webPresenceSection = z
  .object({
    /** Null when service lines are saved but none has enough questions for a map. */
    citationCoverage: citationCoverageSection.nullable(),
    /** Absent until the cited pages have been read (wp_assess). */
    credible: credibleSection.nullable().optional(),
    webPresence: webPresenceRows.nullable().optional(),
    evidence: z.record(z.string(), evidenceEntry),
    copy: z.object({ credibleFoot: copyEntry, citedPagesTitle: copyEntry, citedPagesIntro: copyEntry }).strict().optional(),
  })
  .strict();
export type WebPresenceSection = z.infer<typeof webPresenceSection>;

function input<T>(ctx: StageContext, stage: string, schema: z.ZodType<T>) {
  const i = ctx.inputs[stage];
  if (!i) return null;
  return { ...schema.parse(i.output), runId: i.runId, finishedAt: i.finishedAt ?? new Date().toISOString() };
}

export const wpSection: StageDefinition = {
  id: "wp_section",
  module: "web-presence",
  label: "Web presence 3/3: build the report's web presence parts",
  inputs: ["wp_pages", "pa_assemble"],
  /** The page readings, when they have run. */
  optionalInputs: ["wp_assess"],
  timeoutMs: 20_000,
  maxAttempts: 1,
  autoRun: true,
  parseParams: () => ({}),
  output: webPresenceSection,
  async run(ctx) {
    const cp = input(ctx, "wp_pages", citedPages)!;
    const pa = input(ctx, "pa_assemble", assembledSection)!;
    // Readings of an earlier wp_pages run don't describe these pages: wait for wp_assess to read this run.
    const read = input(ctx, "wp_assess", assessedPages);
    // Credible and the map need at least one page we could read; without one they're left out (Citation coverage
    // still says which pages couldn't be read).
    const as = read && read.fromRun === cp.runId && read.pages.some((p) => p.reading) ? read : null;
    const maps = buildCitationCoverage(cp, pa.section);
    const out: WebPresenceSection = {
      citationCoverage: maps.length ? maps : null,
      credible: as ? buildCredible(cp, as, pa.section, pa.business.name) : null,
      webPresence: as ? buildWebPresence(cp, as) : null,
      evidence: { ...citedPagesEvidence(cp), ...(as ? assessedEvidence(as) : {}) },
      ...(as ? { copy: credibleCopy(cp, as) } : {}),
    };
    return { status: "done", output: out as unknown as JsonValue };
  },
};
