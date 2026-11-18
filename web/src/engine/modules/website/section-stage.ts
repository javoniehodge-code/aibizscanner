import { z } from "zod";
import { copyEntry, evidenceEntry, websiteDiscovery } from "@/report/schema";
import type { JsonValue, StageContext, StageDefinition } from "../../types";
import { jsCheck } from "./js-stage";
import { buildDiscovery, discoveryCopy, sectionEvidence } from "./logic/section";
import { pageSetSpec, snapshots } from "./schemas";
import { findRead, readTests } from "./test-stages";

/** ws_section: the report's website parts built so far, with their evidence and copy (read by report_assemble). */
export const websiteSection = z
  .object({
    discovery: websiteDiscovery,
    evidence: z.record(z.string(), evidenceEntry),
    copy: z.object({ discoveryIntro: copyEntry, discoveryWhyPages: copyEntry }).strict(),
  })
  .strict();
export type WebsiteSection = z.infer<typeof websiteSection>;

function input<T>(ctx: StageContext, stage: string, schema: z.ZodType<T>) {
  const i = ctx.inputs[stage];
  if (!i) return null;
  return { ...schema.parse(i.output), runId: i.runId, finishedAt: i.finishedAt ?? new Date().toISOString() };
}

export const wsSection: StageDefinition = {
  id: "ws_section",
  module: "website",
  label: "Website: build the report's website section",
  inputs: ["ws_page_set", "ws_snapshot", "ws_findread", "ws_render", "ws_read_chatgpt", "ws_read_claude", "ws_read_gemini"],
  timeoutMs: 20_000,
  maxAttempts: 1,
  autoRun: true,
  parseParams: () => ({}),
  output: websiteSection,
  async run(ctx) {
    const set = input(ctx, "ws_page_set", pageSetSpec)!;
    const snap = input(ctx, "ws_snapshot", snapshots)!;
    const fr = input(ctx, "ws_findread", findRead)!;
    const js = input(ctx, "ws_render", jsCheck);
    const reads = ["ws_read_chatgpt", "ws_read_claude", "ws_read_gemini"].map((s) => input(ctx, s, readTests));
    const inputs = { set, snap, findRead: fr, js, reads, snapshotAt: snap.finishedAt };
    const out: WebsiteSection = { discovery: buildDiscovery(inputs), evidence: sectionEvidence(inputs), copy: discoveryCopy(inputs) };
    return { status: "done", output: out as unknown as JsonValue };
  },
};
