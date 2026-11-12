import { backoffMs, estimateCostUsd } from "./cost";
import { MissingPricingError, SpendingCapError, StageTimeoutError, errorMessage, isRetryable } from "./errors";
import { hashJson } from "./json";
import type { StageRegistry } from "./registry";
import type { ClaimedRun, PaidCallSpec, RunStore, StageContext, StageInput, Usage } from "./types";

export type RunOutcome =
  | { runId: string; stage: string; outcome: "done" | "partial"; costUsd: number }
  | { runId: string; stage: string; outcome: "retry"; error: string; runAfter: string }
  | { runId: string; stage: string; outcome: "failed"; error: string }
  /** The lease expired and another worker (or recovery) owns the row; this result was discarded. */
  | { runId: string; stage: string; outcome: "lost" };

export type Clock = { now(): Date };
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
  try {
    const loaded = await store.loadInputs(run.inputRunIds);
    const inputs: Record<string, StageInput> = {};
    for (const input of loaded) inputs[input.stage] = input;
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
      const [spent, cap] = await Promise.all([store.reportSpendUsd(run.reportId), store.reportSpendingCapUsd(run.reportId)]);
      if (spent + estimate > cap) throw new SpendingCapError(spent, estimate, cap);

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
    };
    const result = await Promise.race([stage.run(ctx), timeout]);
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
