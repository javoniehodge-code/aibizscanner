import { z } from "zod";

/**
 * Prompt analysis (brief §4 stages 2–4). This file holds the shapes passed between its steps; the report-facing shape
 * is fixtures/report.schema.json (promptAnalysis).
 */

/**
 * What the extraction instruction must return for ONE engine answer. The LLM interprets; plain code then checks every
 * quote against the answer text (logic/quotes.ts) and does all counting (logic/aggregate.ts).
 */
export const answerExtraction = z
  .object({
    /** Businesses the answer names, in order of first appearance. */
    businesses: z.array(
      z
        .object({
          /** The name as written in the answer. */
          name: z.string().min(1),
          /** recommended: presented as a choice. mentioned: named without recommending. excluded: warned away from. */
          status: z.enum(["recommended", "mentioned", "excluded"]),
          /** Verbatim words from the answer that show the status. */
          quote: z.string().min(1),
          /** Verbatim words giving a reason for or against this business, if the answer states one. */
          reason: z.string().min(1).nullable(),
        })
        .strict(),
    ),
    /** True when the answer groups businesses with no clear order (so positions are meaningless). */
    grouped: z.boolean(),
    /** An explicit stated preference ("my top pick", "I'd start with"), not list position. */
    firstChoice: z
      .object({ name: z.string().min(1), scope: z.string().min(1), quote: z.string().min(1) })
      .strict()
      .nullable(),
    /** Sources the answer names without linking (e.g. "4.8★ on Google"). Never counted as citations. */
    namedSources: z.array(z.object({ source: z.string().min(1), quote: z.string().min(1) }).strict()),
  })
  .strict();
export type AnswerExtraction = z.infer<typeof answerExtraction>;

/** One engine answer as stored by the engine-run step (an engine_answer row, reduced to what extraction needs). */
export const storedAnswer = z
  .object({
    answerId: z.string(),
    promptId: z.string(),
    engine: z.number().int().min(0).max(2),
    status: z.enum(["ok", "error", "refused", "unavailable"]),
    text: z.string().nullable(),
    error: z.string().nullable(),
    /** Citation URLs as returned by the provider (already resolved from redirects where possible). */
    citations: z.array(z.string()),
    searchObserved: z.boolean(),
    respondedAt: z.string().nullable(),
  })
  .strict();
export type StoredAnswer = z.infer<typeof storedAnswer>;

// ---------------------------------------------------------------------------------------------------------------
// Stage outputs
// ---------------------------------------------------------------------------------------------------------------

const text = z.string().trim().min(1);

/** pa_prompt_set: the approved prompt set and the business it is about (params and output are the same). */
export const promptSetSpec = z
  .object({
    promptSet: z.object({ id: z.string().uuid(), version: z.number().int().positive(), approvedAt: z.string() }).strict(),
    target: z
      .object({
        name: text,
        aliases: z.array(text),
        domains: z.array(text),
        location: text,
        category: text,
      })
      .strict(),
    /** Approximate customer location sent to engines that accept one. */
    location: z.object({ city: text, region: text, country: z.string().regex(/^[A-Z]{2}$/), timezone: text }).strict().nullable(),
    groups: z.array(z.object({ name: text, description: text }).strict()).min(1),
    prompts: z
      .array(z.object({ id: z.string().regex(/^P\d+$/), group: z.number().int().min(0), demand: text, text: text }).strict())
      .min(1)
      .max(30),
  })
  .strict()
  .superRefine((s, ctx) => {
    const ids = new Set<string>();
    s.prompts.forEach((p, i) => {
      if (ids.has(p.id)) ctx.addIssue({ code: "custom", message: `Duplicate prompt id ${p.id}`, path: ["prompts", i] });
      ids.add(p.id);
      if (p.group >= s.groups.length) ctx.addIssue({ code: "custom", message: `Prompt ${p.id} group out of range`, path: ["prompts", i] });
    });
  });
export type PromptSetSpec = z.infer<typeof promptSetSpec>;

/**
 * One engine answer as passed downstream. answerId is the engine_answer row holding the original answer and the
 * provider's full response (the evidence).
 */
export const engineAnswer = storedAnswer.extend({
  searchQueries: z.array(z.string()),
  servedModel: z.string().nullable(),
  requestId: z.string().nullable(),
});
export type EngineAnswer = z.infer<typeof engineAnswer>;

/** pa_answers_chatgpt / _claude / _gemini. */
export const engineAnswers = z
  .object({
    engine: z.number().int().min(0).max(2),
    provider: z.string(),
    model: z.string(),
    settings: z.record(z.string(), z.json()),
    configured: z.boolean(),
    answers: z.array(engineAnswer),
  })
  .strict();
export type EngineAnswers = z.infer<typeof engineAnswers>;

/** pa_extract: one entry per usable answer. "failed": no extraction passed the quote check (the answer becomes unavailable). */
export const extractions = z
  .object({
    model: z.string(),
    items: z.array(
      z.discriminatedUnion("status", [
        z
          .object({
            answerId: z.string(),
            status: z.literal("verified"),
            extraction: answerExtraction,
            attempts: z.number().int(),
            /** Optional details removed because their words weren't in the answer (absent on runs before this check). */
            dropped: z.array(z.string()).optional(),
          })
          .strict(),
        z.object({ answerId: z.string(), status: z.literal("failed"), error: z.string(), attempts: z.number().int() }).strict(),
      ]),
    ),
  })
  .strict();
export type Extractions = z.infer<typeof extractions>;
