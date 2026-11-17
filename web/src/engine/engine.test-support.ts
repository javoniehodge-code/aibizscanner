import type { LlmCallRecord } from "./llm";
import type { AnswerEvidence, EngineAnswerRecord, PageSnapshotRecord, FinishStatus, JsonValue, Pricing, RunStore, SourceClassificationRecord, StageInput, UsageRecord } from "./types";

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
  engineAnswers: (EngineAnswerRecord & { id: string })[] = [];
  async recordEngineAnswer(r: EngineAnswerRecord) {
    const id = `ea-${this.engineAnswers.length + 1}`;
    this.engineAnswers.push({ ...r, id });
    return id;
  }
  async loadEngineAnswers(stageRunId: string) {
    return this.engineAnswers.filter((a) => a.stageRunId === stageRunId);
  }
  /** Raw responses by engine_answer id (tests set these; recorded answers are included automatically). */
  rawResponses = new Map<string, JsonValue>();
  async loadAnswerEvidence(ids: readonly string[]): Promise<AnswerEvidence[]> {
    return ids.map((id) => {
      const rec = this.engineAnswers.find((a) => a.id === id);
      return { answerId: id, rawResponse: this.rawResponses.get(id) ?? rec?.rawResponse ?? null, answerText: rec?.answerText ?? null };
    });
  }
  snapshots: (PageSnapshotRecord & { id: string })[] = [];
  async recordPageSnapshot(r: PageSnapshotRecord) {
    const id = `ps-${this.snapshots.length + 1}`;
    this.snapshots.push({ ...r, id });
    return id;
  }
  async loadLatestGoodSnapshots(reportId: string, urls: readonly string[]) {
    const out = new Map<string, { snapshotId: string; text: string; fetchedAt: string }>();
    const good = this.snapshots
      .filter((x) => x.reportId === reportId && x.fetchMode === "raw" && x.httpStatus !== null && x.httpStatus >= 200 && x.httpStatus < 300 && x.text)
      .sort((a, b) => (a.fetchedAt < b.fetchedAt ? 1 : -1));
    for (const u of urls) {
      const hit = good.find((x) => x.url === u);
      if (hit) out.set(u, { snapshotId: hit.id, text: hit.text!, fetchedAt: hit.fetchedAt });
    }
    return out;
  }
  async loadSnapshotTexts(ids: readonly string[]) {
    return new Map(this.snapshots.filter((x) => ids.includes(x.id) && x.text !== null).map((x) => [x.id, x.text!] as const));
  }
  classifications: SourceClassificationRecord[] = [];
  async loadSourceClassifications(keys: readonly string[], version: string) {
    return this.classifications.filter((c) => keys.includes(c.pageKey) && c.classifierVersion === version);
  }
  async recordSourceClassification(r: SourceClassificationRecord) {
    if (!this.classifications.some((c) => c.pageKey === r.pageKey && c.classifierVersion === r.classifierVersion)) this.classifications.push(r);
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

