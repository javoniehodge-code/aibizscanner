import { z } from "zod";
import { MissingPricingError, SpendingCapError, errorMessage } from "../../errors";
import { LlmNotConfiguredError } from "../../llm";
import type { JsonValue, StageContext, StageDefinition } from "../../types";
import { cutWords } from "../content/logic";
import { SCORING_MODEL } from "../content/stages";
import { promptSetSpec } from "../prompt-analysis/schemas";
import { assessPage } from "./instructions/assess-page";
import { checkReading, pageReading } from "./logic/assess";
import { CATEGORY_LABEL } from "./logic/pages";
import { assessedPages, citedPages, type AssessedPages } from "./schemas";

export const ASSESS_VERSION = "2026-11-19";
/** Each page is cut to this many words for the reading (disclosed on the page record). */
const MAX_WORDS = 3000;
const CONCURRENCY = 3;

function input<T>(ctx: StageContext, stage: string, schema: z.ZodType<T>): T {
  const i = ctx.inputs[stage];
  if (!i) throw new Error(`Missing input ${stage}`);
  return schema.parse(i.output);
}

/**
 * wp_assess (stage 8, interpretation): one model reading per checked page of how it presents the business (Claude
 * Sonnet, the scoring model), then the plain-code checks in logic/assess.ts. Pages we couldn't read aren't sent.
 */
export const wpAssess: StageDefinition = {
  id: "wp_assess",
  module: "web-presence",
  label: "Web presence 2/3: read how each cited page presents the business",
  inputs: ["pa_prompt_set", "wp_pages"],
  timeoutMs: 240_000,
  maxAttempts: 2,
  autoRun: true,
  instructions: [assessPage],
  parseParams: (raw) => {
    z.object({}).strict().parse(raw ?? {});
    return {};
  },
  output: assessedPages,
  async run(ctx) {
    const set = input(ctx, "pa_prompt_set", promptSetSpec);
    const cp = input(ctx, "wp_pages", citedPages);
    const checked = cp.pages.filter((p) => p.state === "checked" && p.source);
    const texts = await ctx.snapshotTexts(checked.map((p) => p.source!.snapshotId));
    const target = cp.businesses.find((b) => b.target)!;
    const names = new Map(cp.businesses.map((b) => [b.key, b.name] as const));

    let stop: string | null = null;
    const out: AssessedPages["pages"] = new Array(checked.length);
    let next = 0;
    const work = async () => {
      while (next < checked.length) {
        const i = next++;
        const p = checked[i]!;
        const full = texts.get(p.source!.snapshotId);
        if (!full) {
          out[i] = { key: p.key, cutAt: null, reading: null, error: "Our stored copy of the page wasn't found" };
          continue;
        }
        if (stop) {
          out[i] = { key: p.key, cutAt: null, reading: null, error: stop };
          continue;
        }
        const cut = cutWords(full, MAX_WORDS);
        const targetNamed = p.names.some((n) => n.business === target.key);
        try {
          const r = await ctx.llm({
            instruction: assessPage,
            model: SCORING_MODEL,
            input: {
              business: { name: target.name, otherNames: set.target.aliases, location: set.target.location, category: set.target.category },
              page: { url: p.url, website: p.site, kind: CATEGORY_LABEL[p.category], title: p.title, text: cut.text },
              namedOnPage: { business: targetNamed, others: p.names.filter((n) => n.business !== target.key).map((n) => names.get(n.business) ?? n.business) },
            },
            output: pageReading,
          });
          // Quotes are checked against the copy the model was given.
          out[i] = { key: p.key, cutAt: cut.truncated ? MAX_WORDS : null, reading: checkReading(r, cut.text, targetNamed), error: null };
        } catch (e) {
          const msg = errorMessage(e);
          if (e instanceof SpendingCapError || e instanceof MissingPricingError || e instanceof LlmNotConfiguredError) stop = msg;
          out[i] = { key: p.key, cutAt: null, reading: null, error: msg };
        }
      }
    };
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, checked.length) }, work));
    const result: AssessedPages = { version: ASSESS_VERSION, model: SCORING_MODEL.model, fromRun: ctx.inputs["wp_pages"]!.runId, pages: out };
    return { status: out.every((p) => p.reading) ? "done" : "partial", output: result as unknown as JsonValue };
  },
};
