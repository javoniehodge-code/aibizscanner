import { backoffMs, estimateCostUsd } from "./cost";
import { MissingPricingError, NonRetryableError, SpendingCapError, StageTimeoutError, errorMessage, isRetryable } from "./errors";
import { hashJson } from "./json";
import type { AnswerEngines } from "./answers";
import { createStructuredCall, instructionRef, type LlmClient } from "./llm";
import type { StageRegistry } from "./registry";
import type { ClaimedRun, InstructionRef, PaidCallSpec, RunStore, StageContext, StageInput, Usage } from "./types";

export type RunOutcome =
  | { runId: string; stage: string; outcome: "done" | "partial"; costUsd: number }
  | { runId: string; stage: string; outcome: "retry"; error: string; runAfter: string }
  | { runId: string; stage: string; outcome: "failed"; error: string }
  /** The lease expired and another worker (or recovery) owns the row; this result was discarded. */
  | { runId: string; stage: string; outcome: "lost" };

export type Clock = { now(): Date };

/** Paid-API clients the worker hands to stages. Missing ones make ctx.llm throw / ctx.answerEngine return null. */
export type Providers = { llm?: LlmClient | null; answers?: AnswerEngines };

/** Data that doesn't match its declared schema. Never retried: the same code would produce the same result. */
export class SchemaError extends NonRetryableError {
  constructor(what: string, issues: { path: PropertyKey[]; message: string }[]) {
    super(`${what} doesn't match its schema: ${issues.slice(0, 5).map((i) => `${i.path.map(String).join(".") || "(root)"}: ${i.message}`).join("; ")}`);
    this.name = "SchemaError";
  }
}

const sameRefs = (a: readonly InstructionRef[], b: readonly InstructionRef[]) =>
  a.length === b.length && a.every((x) => b.some((y) => y.id === x.id && y.version === x.version && y.sha256 === x.sha256));
const systemClock: Clock = { now: () => new Date() };

const ZERO_USAGE: Usage = { tokensIn: 0, tokensOut: 0, searchCalls: 0, requests: 0 };

/**
 * Executes one claimed stage run: loads its inputs, runs the stage with a timeout, routes every paid call through the
 * spending cap and usage log, then finishes the run or schedules a retry with backoff.
 */
export async function executeRun(
  store: RunStore,
  registry: StageRegistry,
  run: ClaimedRun,
  clock: Clock = systemClock,
  providers: Providers = {},
): Promise<RunOutcome> {
  const base = { runId: run.id, stage: run.stage };
  const stage = registry.get(run.stage);
  if (!stage) {
    const error = `Unknown stage "${run.stage}" (not in the registry)`;
    return (await store.finish(run.id, run.attempt, "failed", null, null, error))
      ? { ...base, outcome: "failed", error }
      : { ...base, outcome: "lost" };
  }

  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      const err = new StageTimeoutError(run.timeoutMs);
      controller.abort(err);
      reject(err);
    }, run.timeoutMs);
  });

  let attemptCost = 0;
  // Estimates of this attempt's calls still in flight. Stages may run calls concurrently; each cap check counts the
  // others' estimates so together they can't pass the cap.
  let inFlightUsd = 0;
  try {
    // Instructions: the versions in the code must be the ones recorded when the run was queued.
    const refs = await Promise.all((stage.instructions ?? []).map(instructionRef));
    if (!sameRefs(refs, run.instructions)) {
      throw new NonRetryableError("The stage's instructions changed after this run was queued. Rerun the stage to use the current versions.");
    }
    for (const [i, ref] of refs.entries()) await store.recordInstruction({ ...ref, text: (stage.instructions ?? [])[i]!.text });

    const loaded = await store.loadInputs(run.inputRunIds);
    const inputs: Record<string, StageInput> = {};
    for (const input of loaded) {
      // Re-check stored outputs against the upstream stage's current schema before using them.
      const upstream = registry.get(input.stage);
      const check = upstream?.output.safeParse(input.output);
      if (check && !check.success) throw new SchemaError(`Input from ${input.stage} (run ${input.runId})`, check.error.issues);
      inputs[input.stage] = input;
    }
    const missing = stage.inputs.filter((s) => !inputs[s]);
    if (missing.length) throw new Error(`Missing inputs from stage(s): ${missing.join(", ")}`);

    const paidCall = async <T,>(
      spec: PaidCallSpec,
      call: (signal: AbortSignal) => Promise<{ result: T; usage: Usage }>,
    ): Promise<T> => {
      controller.signal.throwIfAborted();
      const pricing = await store.latestPricing(spec.provider, spec.model);
      if (!pricing) throw new MissingPricingError(spec.provider, spec.model);
      const estimate = estimateCostUsd(pricing, spec.estimate);
      inFlightUsd += estimate;
      let reserved = true;
      const release = () => {
        if (reserved) inFlightUsd -= estimate;
        reserved = false;
      };
      try {
        const [spent, cap] = await Promise.all([store.reportSpendUsd(run.reportId), store.reportSpendingCapUsd(run.reportId)]);
        if (spent + inFlightUsd > cap) throw new SpendingCapError(spent + inFlightUsd - estimate, estimate, cap);
      } catch (e) {
        release();
        throw e;
      }

      const started = Date.now();
      try {
        const { result, usage } = await call(controller.signal);
        const costUsd = estimateCostUsd(pricing, usage);
        attemptCost += costUsd;
        await store.recordUsage({
          stageRunId: run.id,
          attempt: run.attempt,
          provider: spec.provider,
          model: spec.model,
          pricingId: pricing.id,
          usage,
          costUsd,
          durationMs: Date.now() - started,
          succeeded: true,
          error: null,
        });
        release();
        return result;
      } catch (e) {
        // A failed call is still logged. Without a usage report we assume one billed request and no tokens.
        const usage = { ...ZERO_USAGE, requests: 1 };
        const costUsd = estimateCostUsd(pricing, usage);
        attemptCost += costUsd;
        await store.recordUsage({
          stageRunId: run.id,
          attempt: run.attempt,
          provider: spec.provider,
          model: spec.model,
          pricingId: pricing.id,
          usage,
          costUsd,
          durationMs: Date.now() - started,
          succeeded: false,
          error: errorMessage(e),
        });
        release();
        throw e;
      }
    };

    const ctx: StageContext = {
      reportId: run.reportId,
      runId: run.id,
      attempt: run.attempt,
      params: run.params,
      inputs,
      signal: controller.signal,
      paidCall,
      recordEngineAnswer: (r) => store.recordEngineAnswer(r),
      priorEngineAnswers: () => store.loadEngineAnswers(run.id),
      answerEngine: (engine) => providers.answers?.(engine) ?? null,
      llm: createStructuredCall({
        client: providers.llm ?? null,
        declared: refs,
        stageRunId: run.id,
        attempt: run.attempt,
        signal: controller.signal,
        paidCall,
        record: (r) => store.recordLlmCall(r),
      }),
    };
    const result = await Promise.race([stage.run(ctx), timeout]);
    const valid = stage.output.safeParse(result.output);
    if (!valid.success) throw new SchemaError(`Output of ${stage.id}`, valid.error.issues);
    const outputHash = await hashJson(result.output);
    return (await store.finish(run.id, run.attempt, result.status, result.output, outputHash, null))
      ? { ...base, outcome: result.status, costUsd: attemptCost }
      : { ...base, outcome: "lost" };
  } catch (e) {
    const error = `attempt ${run.attempt}: ${errorMessage(e)}`;
    if (isRetryable(e) && run.attempt < run.maxAttempts) {
      const runAfter = new Date(clock.now().getTime() + backoffMs(run.attempt));
      return (await store.retry(run.id, run.attempt, error, runAfter))
        ? { ...base, outcome: "retry", error, runAfter: runAfter.toISOString() }
        : { ...base, outcome: "lost" };
    }
    return (await store.finish(run.id, run.attempt, "failed", null, null, error))
      ? { ...base, outcome: "failed", error }
      : { ...base, outcome: "lost" };
  } finally {
    clearTimeout(timer);
    // Stops any work still listening to the signal (e.g. after a stage error).
    if (!controller.signal.aborted) controller.abort(new Error("stage finished"));
  }
}
