import { z } from "zod";
import { evidenceEntry, promptAnalysis } from "@/report/schema";
import { ENGINE_NAMES, type EngineIndex } from "../../answers";
import { MissingPricingError, NonRetryableError, SpendingCapError, errorMessage, isRetryable } from "../../errors";
import { LlmNotConfiguredError } from "../../llm";
import type { JsonValue, StageContext, StageDefinition } from "../../types";
import { extractAnswer } from "./instructions/extract-answer";
import { buildPromptAnalysisSection } from "./logic/section";
import { unverifiedQuotes } from "./logic/quotes";
import { ENGINE_MODELS, EXTRACTION_MODEL } from "./models";
import {
  answerExtraction,
  engineAnswers,
  extractions,
  promptSetSpec,
  type EngineAnswer,
  type EngineAnswers,
  type Extractions,
  type PromptSetSpec,
} from "./schemas";

const MODULE = "prompt-analysis";
/** How many questions are in flight at once per engine, and per-answer time limit. Fits the 300 s worker tick. */
const ANSWER_CONCURRENCY = 6;
const ANSWER_TIMEOUT_MS = 120_000;
const EXTRACT_CONCURRENCY = 6;
const EXTRACT_ATTEMPTS = 2;

/** Runs fn over items with at most `limit` in flight, keeping order. */
async function mapLimit<T, R>(items: readonly T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]!);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

const emptyParams = (raw: unknown) => {
  z.object({}).strict().parse(raw ?? {});
  return {};
};

function input<T>(ctx: StageContext, stage: string, schema: z.ZodType<T>): T & { runId: string } {
  const i = ctx.inputs[stage];
  if (!i) throw new Error(`Missing input ${stage}`);
  return { ...schema.parse(i.output), runId: i.runId };
}

// ---------------------------------------------------------------------------------------------------------------
// pa_prompt_set: the approved prompt set and target, frozen into the pipeline
// ---------------------------------------------------------------------------------------------------------------

export const paPromptSet: StageDefinition = {
  id: "pa_prompt_set",
  module: MODULE,
  label: "Prompt analysis 1/4: approved prompt set",
  inputs: [],
  timeoutMs: 10_000,
  maxAttempts: 1,
  parseParams: (raw) => promptSetSpec.parse(raw) as unknown as Record<string, JsonValue>,
  output: promptSetSpec,
  async run(ctx) {
    return { status: "done", output: promptSetSpec.parse(ctx.params) as unknown as JsonValue };
  },
};

// ---------------------------------------------------------------------------------------------------------------
// pa_answers_*: ask every question to one engine, web search on
// ---------------------------------------------------------------------------------------------------------------

function answersStage(engine: EngineIndex): StageDefinition {
  const name = ENGINE_NAMES[engine];
  const spec = ENGINE_MODELS[engine];
  return {
    id: `pa_answers_${name.toLowerCase()}`,
    module: MODULE,
    label: `Prompt analysis 2/4: ${name} answers`,
    inputs: ["pa_prompt_set"],
    timeoutMs: 280_000,
    // Retrying re-asks every question; only a run where every question failed for a transient reason is retried.
    maxAttempts: 2,
    autoRun: true,
    parseParams: emptyParams,
    output: engineAnswers,
    async run(ctx) {
      const set = input(ctx, "pa_prompt_set", promptSetSpec);
      const client = ctx.answerEngine(engine);
      const prompts = new Map(set.prompts.map((p) => [p.id, p]));
      const settings = client?.settings ?? {};
      /** Stores the answer as evidence (engine_answer) and returns it with the stored row's id. */
      const keep = async (a: Omit<EngineAnswer, "answerId">, requestedAt: string, raw: JsonValue | null): Promise<EngineAnswer> => {
        const answerId = await ctx.recordEngineAnswer({
          reportId: ctx.reportId,
          stageRunId: ctx.runId,
          promptSetId: set.promptSet.id,
          promptId: a.promptId,
          promptText: prompts.get(a.promptId)?.text ?? "",
          engine: name.toLowerCase() as "chatgpt" | "claude" | "gemini",
          model: client?.model ?? spec.model,
          requestId: a.requestId,
          settings: { ...settings, maxSearches: spec.maxSearches, location: set.location, servedModel: a.servedModel, searchQueries: a.searchQueries },
          rawResponse: raw,
          answerText: a.text,
          citations: a.citations.map((url) => ({ url })),
          status: a.status,
          error: a.error,
          requestedAt,
          respondedAt: a.respondedAt,
        });
        return { answerId, ...a };
      };
      const unavailable = (promptId: string, error: string, status: "unavailable" | "error" = "unavailable") =>
        keep(
          { promptId, engine, status, text: null, error, citations: [], searchObserved: false, respondedAt: null, searchQueries: [], servedModel: null, requestId: null },
          new Date().toISOString(),
          null,
        );
      if (!client) {
        const output: EngineAnswers = {
          engine,
          provider: spec.provider,
          model: spec.model,
          settings: {},
          configured: false,
          answers: await Promise.all(set.prompts.map((p) => unavailable(p.id, `${name} is not configured (its API key is not set)`))),
        };
        return { status: "partial", output: output as unknown as JsonValue };
      }

      let stopReason: string | null = null; // set once the cap or a missing price makes further calls pointless
      const errors: unknown[] = [];
      const answers = await mapLimit(set.prompts, ANSWER_CONCURRENCY, async (p): Promise<EngineAnswer> => {
        if (stopReason) return unavailable(p.id, stopReason, "error");
        const request = { question: p.text, location: set.location, maxSearches: spec.maxSearches };
        const requestedAt = new Date().toISOString();
        let r;
        try {
          r = await ctx.paidCall({ provider: client.provider, model: client.model, estimate: client.estimate(request) }, async (signal) => {
            const res = await client.ask(request, AbortSignal.any([signal, AbortSignal.timeout(ANSWER_TIMEOUT_MS)]));
            return { result: res, usage: res.usage };
          });
        } catch (e) {
          errors.push(e);
          if (e instanceof SpendingCapError || e instanceof MissingPricingError) stopReason = errorMessage(e);
          return unavailable(p.id, errorMessage(e), "error");
        }
        const ok = r.status === "ok" && r.text.trim().length > 0;
        return keep(
          {
            promptId: p.id,
            engine,
            status: r.status === "refused" ? "refused" : ok ? "ok" : "error",
            text: r.text.trim() || null,
            error: r.status === "refused" ? `${name} declined to answer` : ok ? null : "Empty answer",
            citations: r.citations,
            searchObserved: r.searchQueries.length > 0 || r.usage.searchCalls > 0 || r.citations.length > 0,
            respondedAt: new Date().toISOString(),
            searchQueries: r.searchQueries,
            servedModel: r.servedModel,
            requestId: r.requestId,
          },
          requestedAt,
          r.raw,
        );
      });
      if (!answers.some((a) => a.status === "ok" || a.status === "refused")) {
        const first = errors[0];
        const message = `No ${name} answers: ${first ? errorMessage(first) : "every answer was empty"}`;
        if (first && errors.every(isRetryable)) throw new Error(message);
        throw new NonRetryableError(message);
      }
      const output: EngineAnswers = { engine, provider: client.provider, model: client.model, settings: client.settings, configured: true, answers };
      return { status: answers.every((a) => a.status === "ok") ? "done" : "partial", output: output as unknown as JsonValue };
    },
  };
}

export const paAnswersChatGpt = answersStage(0);
export const paAnswersClaude = answersStage(1);
export const paAnswersGemini = answersStage(2);
const ANSWER_STAGES = [paAnswersChatGpt.id, paAnswersClaude.id, paAnswersGemini.id] as const;

// ---------------------------------------------------------------------------------------------------------------
// pa_extract: read each answer (LLM), then check every quote against the answer (plain code)
// ---------------------------------------------------------------------------------------------------------------

export const paExtract: StageDefinition = {
  id: "pa_extract",
  module: MODULE,
  label: "Prompt analysis 3/4: read answers",
  inputs: ["pa_prompt_set", ...ANSWER_STAGES],
  timeoutMs: 240_000,
  maxAttempts: 2,
  autoRun: true,
  instructions: [extractAnswer],
  parseParams: emptyParams,
  output: extractions,
  async run(ctx) {
    const set = input(ctx, "pa_prompt_set", promptSetSpec);
    const prompts = new Map(set.prompts.map((p) => [p.id, p]));
    const usable = ANSWER_STAGES.flatMap((s) => input(ctx, s, engineAnswers).answers).filter((a) => a.status === "ok" && a.text);
    const target = { name: set.target.name, otherNames: set.target.aliases, website: set.target.domains };

    let stopReason: string | null = null;
    const items = await mapLimit(usable, EXTRACT_CONCURRENCY, async (a): Promise<Extractions["items"][number]> => {
      let lastError = "not attempted";
      for (let attempt = 1; attempt <= EXTRACT_ATTEMPTS; attempt++) {
        if (stopReason) return { answerId: a.answerId, status: "failed", error: stopReason, attempts: attempt - 1 };
        try {
          const extraction = await ctx.llm({
            instruction: extractAnswer,
            model: EXTRACTION_MODEL,
            input: { question: prompts.get(a.promptId)?.text ?? "", answer: a.text, targetBusiness: target },
            output: answerExtraction,
          });
          const bad = unverifiedQuotes(extraction, a.text ?? "");
          if (!bad.length) return { answerId: a.answerId, status: "verified", extraction, attempts: attempt };
          lastError = `quoted words not found in the answer: ${bad.slice(0, 3).map((q) => JSON.stringify(q.slice(0, 80))).join(", ")}`;
        } catch (e) {
          lastError = errorMessage(e);
          if (e instanceof SpendingCapError || e instanceof MissingPricingError || e instanceof LlmNotConfiguredError) stopReason = lastError;
          else if (!isRetryable(e)) return { answerId: a.answerId, status: "failed", error: lastError, attempts: attempt };
        }
      }
      return { answerId: a.answerId, status: "failed", error: lastError, attempts: EXTRACT_ATTEMPTS };
    });
    if (usable.length && !items.some((i) => i.status === "verified")) {
      throw new NonRetryableError(`No answer could be read: ${items[0]?.status === "failed" ? items[0].error : "unknown"}`);
    }
    const output: Extractions = { model: EXTRACTION_MODEL.model, items };
    return { status: items.every((i) => i.status === "verified") ? "done" : "partial", output: output as unknown as JsonValue };
  },
};

// ---------------------------------------------------------------------------------------------------------------
// pa_assemble: the report's promptAnalysis section (plain code)
// ---------------------------------------------------------------------------------------------------------------

export const assembledSection = z
  .object({
    section: promptAnalysis,
    evidence: z.record(z.string(), evidenceEntry),
    engines: z.tuple([
      z.object({ name: z.literal("ChatGPT"), model: z.string() }).strict(),
      z.object({ name: z.literal("Claude"), model: z.string() }).strict(),
      z.object({ name: z.literal("Gemini"), model: z.string() }).strict(),
    ]),
    business: z.object({ key: z.string(), name: z.string(), location: z.string(), domain: z.string() }).strict(),
  })
  .strict();

export const paAssemble: StageDefinition = {
  id: "pa_assemble",
  module: MODULE,
  label: "Prompt analysis 4/4: assemble section",
  inputs: ["pa_prompt_set", ...ANSWER_STAGES, "pa_extract"],
  timeoutMs: 20_000,
  maxAttempts: 1,
  autoRun: true,
  parseParams: emptyParams,
  output: assembledSection,
  async run(ctx) {
    const set: PromptSetSpec & { runId: string } = input(ctx, "pa_prompt_set", promptSetSpec);
    const [a0, a1, a2] = ANSWER_STAGES.map((s) => input(ctx, s, engineAnswers));
    const ex = input(ctx, "pa_extract", extractions);
    const built = buildPromptAnalysisSection({ set, setRunId: set.runId, engines: [a0!, a1!, a2!], extractions: ex, extractRunId: ex.runId });
    return { status: built.section.run.v && built.section.run.v.unavailable === 0 ? "done" : "partial", output: built as unknown as JsonValue };
  },
};

export const PROMPT_ANALYSIS_STAGES = [paPromptSet, paAnswersChatGpt, paAnswersClaude, paAnswersGemini, paExtract, paAssemble] as const;
