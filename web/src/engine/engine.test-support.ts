import type { LlmCallRecord } from "./llm";
import type { FinishStatus, JsonValue, Pricing, RunStore, StageInput, UsageRecord } from "./types";

/** In-memory RunStore for engine tests. */
export const PRICE: Pricing = {
  id: 7,
  provider: "dummy",
  model: "fake-model-1",
  version: 1,
  inputUsdPerMtok: 1,
  outputUsdPerMtok: 2,
  searchUsdPerCall: 0.01,
  requestUsdPerCall: 0,
};

export class MemoryStore implements RunStore {
  usage: UsageRecord[] = [];
  finished: { status: FinishStatus; output: JsonValue | null; outputHash: string | null; error: string | null } | null = null;
  retried: { error: string; runAfter: Date } | null = null;
  ownsRun = true;
  constructor(
    public capUsd = 5,
    public priorSpendUsd = 0,
    public inputs: StageInput[] = [],
    public pricing: Pricing | null = PRICE,
  ) {}
  async loadInputs(ids: readonly string[]) {
    return this.inputs.filter((i) => ids.includes(i.runId));
  }
  async latestPricing() {
    return this.pricing;
  }
  async reportSpendUsd() {
    return this.priorSpendUsd + this.usage.reduce((s, u) => s + u.costUsd, 0);
  }
  async reportSpendingCapUsd() {
    return this.capUsd;
  }
  async recordUsage(r: UsageRecord) {
    this.usage.push(r);
  }
  instructions: { id: string; version: number; sha256: string; text: string }[] = [];
  llmCalls: LlmCallRecord[] = [];
  async recordInstruction(i: { id: string; version: number; sha256: string; text: string }) {
    this.instructions.push(i);
  }
  async recordLlmCall(r: LlmCallRecord) {
    this.llmCalls.push(r);
  }
  async retry(_id: string, _attempt: number, error: string, runAfter: Date) {
    if (!this.ownsRun) return false;
    this.retried = { error, runAfter };
    return true;
  }
  async finish(_id: string, _a: number, status: FinishStatus, output: JsonValue | null, outputHash: string | null, error: string | null) {
    if (!this.ownsRun) return false;
    this.finished = { status, output, outputHash, error };
    return true;
  }
}

