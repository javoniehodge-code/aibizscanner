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
