import type { z } from "zod";
import type { Instruction, LlmCallRecord, LlmStructuredCall } from "./llm";

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
  /**
   * One structured LLM call with a versioned instruction (see llm.ts). Output is validated against the given zod schema;
   * every call, valid or not, is recorded with its raw response. Throws if no LLM client is configured.
   */
  llm: LlmStructuredCall;
};

export type StageResult = { status: "done" | "partial"; output: JsonValue };

export type StageDefinition = {
  id: StageId;
  /** Module the stage belongs to (folder under engine/modules). */
  module: string;
  label: string;
  /** Upstream stages whose latest finished output this stage reads. Used for input hashing and stale marking. */
  inputs: readonly StageId[];
  timeoutMs: number;
  maxAttempts: number;
  /** Validates and defaults params before enqueueing; throws to refuse. */
  parseParams(raw: unknown): JsonObject;
  /**
   * Shape of the stage's output. The executor rejects output that doesn't match (the run fails; nothing invalid is
   * stored as done), and re-checks stored outputs before handing them to downstream stages.
   */
  output: z.ZodType;
  /** LLM instructions the stage may use. Their exact versions are recorded on every run and in its inputs hash. */
  instructions?: readonly Instruction[];
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
  /** Instruction versions recorded when the run was queued. */
  instructions: InstructionRef[];
};

/** Reference to one version of an instruction, as recorded on a stage run. */
export type InstructionRef = { id: string; version: number; sha256: string };

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
  /** Stores an instruction version's full text once; refuses a different text under an existing id and version. */
  recordInstruction(instruction: InstructionRef & { text: string }): Promise<void>;
  recordLlmCall(record: LlmCallRecord): Promise<void>;
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
