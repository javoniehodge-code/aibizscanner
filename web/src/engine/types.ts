/**
 * Report engine contracts. The engine (this folder) must not import the worker, HTTP routes, Next.js or Supabase:
 * it talks to storage only through the RunStore port below, so execution can move to another host later.
 * ESLint enforces this boundary (see eslint.config.mjs).
 */

export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };
export type JsonObject = { [key: string]: JsonValue };

export type StageId = string;

export type RunStatus = "queued" | "running" | "done" | "failed" | "partial";

/** Token / search usage reported by one paid call. */
export type Usage = { tokensIn: number; tokensOut: number; searchCalls: number; requests: number };

export type Pricing = {
  id: number;
  provider: string;
  model: string;
  version: number;
  inputUsdPerMtok: number;
  outputUsdPerMtok: number;
  searchUsdPerCall: number;
  requestUsdPerCall: number;
};

export type PaidCallSpec = {
  provider: string;
  model: string;
  /** Upper bound used for the spending-cap check before the call is made. */
  estimate: Usage;
};

/** Output of an upstream stage run that this run consumes. */
export type StageInput = { runId: string; stage: StageId; output: JsonValue; outputHash: string | null };

export type StageContext = {
  reportId: string;
  runId: string;
  attempt: number;
  params: JsonObject;
  inputs: Readonly<Record<StageId, StageInput>>;
  signal: AbortSignal;
  /**
   * The only way a stage may spend money. Checks the report's spending cap first, then records tokens, search calls,
   * estimated USD (with the pricing row used) and duration, whether the call succeeds or fails.
   */
  paidCall<T>(spec: PaidCallSpec, call: (signal: AbortSignal) => Promise<{ result: T; usage: Usage }>): Promise<T>;
};

export type StageResult = { status: "done" | "partial"; output: JsonValue };

export type StageDefinition = {
  id: StageId;
  label: string;
  /** Upstream stages whose latest finished output this stage reads. Used for input hashing and stale marking. */
  inputs: readonly StageId[];
  timeoutMs: number;
  maxAttempts: number;
  /** Validates and defaults params before enqueueing; throws to refuse. */
  parseParams(raw: unknown): JsonObject;
  run(ctx: StageContext): Promise<StageResult>;
};

/** A claimed queue row, as the engine sees it. */
export type ClaimedRun = {
  id: string;
  reportId: string;
  stage: StageId;
  version: number;
  attempt: number;
  maxAttempts: number;
  timeoutMs: number;
  params: JsonObject;
  inputRunIds: string[];
};

export type UsageRecord = {
  stageRunId: string;
  attempt: number;
  provider: string;
  model: string;
  pricingId: number;
  usage: Usage;
  costUsd: number;
  durationMs: number;
  succeeded: boolean;
  error: string | null;
};

export type FinishStatus = "done" | "partial" | "failed";

/** Storage port implemented by the worker layer (Supabase) and by in-memory fakes in tests. */
export interface RunStore {
  loadInputs(runIds: readonly string[]): Promise<StageInput[]>;
  latestPricing(provider: string, model: string): Promise<Pricing | null>;
  reportSpendUsd(reportId: string): Promise<number>;
  reportSpendingCapUsd(reportId: string): Promise<number>;
  recordUsage(record: UsageRecord): Promise<void>;
  /** Returns false if the run is no longer ours (lease lost) or has no attempts left. */
  retry(runId: string, attempt: number, error: string, runAfter: Date): Promise<boolean>;
  /** Returns false if the run is no longer ours (lease lost); the result is then discarded. */
  finish(
    runId: string,
    attempt: number,
    status: FinishStatus,
    output: JsonValue | null,
    outputHash: string | null,
    error: string | null,
  ): Promise<boolean>;
}
