import { z } from "zod";
import { reportDocument } from "@/report/schema";
import type { JsonValue, StageContext, StageDefinition } from "../../types";
import { assembledSection } from "../prompt-analysis/stages";
import { websiteSection } from "../website/section-stage";
import { buildReportDocument } from "./logic/document";

export const MODULE = "report";
const emptyParams = (raw: unknown) => z.object({}).strict().parse(raw ?? {});

function upstream<T>(ctx: StageContext, stage: string, schema: z.ZodType<T>): T {
  const i = ctx.inputs[stage];
  if (!i) throw new Error(`Missing input ${stage}`);
  return schema.parse(i.output);
}

/**
 * Stage 12: report assembly. Builds the report document the design template renders, from the finished sections.
 * When the run finishes, the database stores the output as a new report_document version (migration
 * 20261114000100), so the report view always shows the latest assembly and keeps the earlier ones.
 * Reads the prompt analysis and, when it has run, the website section; later sections join as their stages are built.
 */
export const reportAssemble: StageDefinition = {
  id: "report_assemble",
  module: MODULE,
  label: "Report: assemble the report document",
  inputs: ["pa_assemble"],
  /** The website section, when its stages have run. */
  optionalInputs: ["ws_section"],
  timeoutMs: 20_000,
  maxAttempts: 1,
  autoRun: true,
  parseParams: emptyParams,
  output: reportDocument,
  async run(ctx) {
    const site = ctx.inputs["ws_section"];
    const doc = buildReportDocument(upstream(ctx, "pa_assemble", assembledSection), site ? websiteSection.parse(site.output) : null);
    return { status: "done", output: doc as unknown as JsonValue };
  },
};

export const REPORT_STAGES = [reportAssemble] as const;
