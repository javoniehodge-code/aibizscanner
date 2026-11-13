import { describe, expect, it } from "vitest";
import { backoffMs, estimateCostUsd } from "./cost";
import { executeRun } from "./execute";
import { inputsHash } from "./hash";
import { stableStringify } from "./json";
import { createRegistry } from "./registry";
import { dummyPricedCall, dummySummary } from "./modules/dummy/stages";
import type { ClaimedRun, StageDefinition, StageInput } from "./types";
import { registry } from "./index";
import { MemoryStore, PRICE } from "./engine.test-support";

function claimed(overrides: Partial<ClaimedRun> = {}): ClaimedRun {
  return {
    id: "run-1",
    reportId: "report-1",
    stage: "dummy_priced_call",
    version: 1,
    attempt: 1,
    maxAttempts: 3,
    timeoutMs: 5_000,
    params: dummyPricedCall.parseParams({ delayMs: 1 }),
    inputRunIds: [],
    instructions: [],
    ...overrides,
  };
}

const fixedClock = { now: () => new Date("2026-11-12T12:00:00Z") };

describe("cost and backoff", () => {
  it("prices tokens per million, search calls and requests", () => {
    expect(estimateCostUsd(PRICE, { tokensIn: 1200, tokensOut: 300, searchCalls: 1, requests: 1 })).toBe(0.0118);
    expect(estimateCostUsd({ ...PRICE, requestUsdPerCall: 0.002 }, { tokensIn: 0, tokensOut: 0, searchCalls: 0, requests: 2 })).toBe(0.004);
  });
  it("backs off exponentially with a cap", () => {
    expect([1, 2, 3, 4].map((n) => backoffMs(n))).toEqual([15_000, 30_000, 60_000, 120_000]);
    expect(backoffMs(30)).toBe(600_000);
  });
});

describe("inputsHash", () => {
  it("is stable under key order and input order, and changes with inputs", async () => {
    const a: StageInput = { runId: "r1", stage: "a", output: null, outputHash: "h1" };
    const b: StageInput = { runId: "r2", stage: "b", output: null, outputHash: "h2" };
    const h1 = await inputsHash("s", { x: 1, y: 2 }, [a, b]);
    const h2 = await inputsHash("s", { y: 2, x: 1 }, [b, a]);
    expect(h1).toBe(h2);
    expect(h1).toMatch(/^[0-9a-f]{64}$/);
    expect(await inputsHash("s", { x: 1, y: 2 }, [a, { ...b, outputHash: "h3" }])).not.toBe(h1);
    expect(stableStringify({ b: [1, { d: 1, c: 2 }], a: null })).toBe('{"a":null,"b":[1,{"c":2,"d":1}]}');
  });
});

describe("registry", () => {
  const stage = (id: string, inputs: string[] = []): StageDefinition => ({
    ...dummySummary,
    id,
    inputs,
  });
  it("computes transitive downstream stages", () => {
    const r = createRegistry([stage("a"), stage("b", ["a"]), stage("c", ["b"]), stage("d", ["a"])]);
    expect(r.downstreamOf("a").sort()).toEqual(["b", "c", "d"]);
    expect(r.downstreamOf("c")).toEqual([]);
  });
  it("rejects duplicates, unknown inputs and cycles", () => {
    expect(() => createRegistry([stage("a"), stage("a")])).toThrow(/Duplicate/);
    expect(() => createRegistry([stage("a", ["zzz"])])).toThrow(/unknown stage/);
    expect(() => createRegistry([stage("a", ["b"]), stage("b", ["a"])])).toThrow(/cycle/);
  });
  it("the app registry is valid and dummy_summary is downstream of dummy_priced_call", () => {
    expect(registry.downstreamOf("dummy_priced_call")).toEqual(["dummy_summary"]);
  });
});

describe("executeRun", () => {
  it("runs the dummy stage, logs the priced call and finishes done", async () => {
    const store = new MemoryStore();
    const out = await executeRun(store, registry, claimed());
    expect(out).toEqual({ runId: "run-1", stage: "dummy_priced_call", outcome: "done", costUsd: 0.0118 });
    expect(store.usage).toHaveLength(1);
    expect(store.usage[0]).toMatchObject({ pricingId: 7, costUsd: 0.0118, succeeded: true, attempt: 1 });
    expect(store.usage[0]?.usage).toEqual({ tokensIn: 1200, tokensOut: 300, searchCalls: 1, requests: 1 });
    expect(store.finished?.status).toBe("done");
    expect(store.finished?.outputHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("schedules a retry with backoff after a retryable failure and logs the failed call", async () => {
    const store = new MemoryStore();
    const run = claimed({ params: dummyPricedCall.parseParams({ delayMs: 1, failAttempts: 1 }) });
    const out = await executeRun(store, registry, run, fixedClock);
    expect(out.outcome).toBe("retry");
    expect(store.retried?.runAfter.toISOString()).toBe("2026-11-12T12:00:15.000Z");
    expect(store.retried?.error).toMatch(/attempt 1: Simulated provider error/);
    expect(store.usage[0]).toMatchObject({ succeeded: false, costUsd: 0 });
    expect(store.finished).toBeNull();
  });

  it("fails for good once attempts are used up", async () => {
    const store = new MemoryStore();
    const run = claimed({ attempt: 3, params: dummyPricedCall.parseParams({ delayMs: 1, failAttempts: 5 }) });
    const out = await executeRun(store, registry, run);
    expect(out.outcome).toBe("failed");
    expect(store.finished?.status).toBe("failed");
    expect(store.retried).toBeNull();
  });

  it("refuses a paid call that would exceed the report's spending cap, without retrying", async () => {
    const store = new MemoryStore(0.01, 0.005);
    const out = await executeRun(store, registry, claimed());
    expect(out.outcome).toBe("failed");
    expect(store.finished?.error).toMatch(/Spending cap reached/);
    expect(store.usage).toHaveLength(0);
    expect(store.retried).toBeNull();
  });

  it("fails without retry when there is no pricing row", async () => {
    const store = new MemoryStore(5, 0, [], null);
    const out = await executeRun(store, registry, claimed());
    expect(out.outcome).toBe("failed");
    expect(store.finished?.error).toMatch(/No pricing row for dummy\/fake-model-1/);
  });

  it("times out a slow stage and retries it", async () => {
    const store = new MemoryStore();
    const run = claimed({ timeoutMs: 20, params: dummyPricedCall.parseParams({ delayMs: 5_000 }) });
    const out = await executeRun(store, registry, run, fixedClock);
    expect(out.outcome).toBe("retry");
    expect(store.retried?.error).toMatch(/Timed out after 20 ms/);
  });

  it("passes upstream outputs to downstream stages and reports partial results", async () => {
    const usage = { tokensIn: 1, tokensOut: 1, searchCalls: 0, requests: 1 };
    const input: StageInput = { runId: "up-1", stage: "dummy_priced_call", output: { answer: "", usage }, outputHash: "h" };
    const store = new MemoryStore(5, 0, [input]);
    const out = await executeRun(store, registry, claimed({ stage: "dummy_summary", params: {}, inputRunIds: ["up-1"] }));
    expect(out.outcome).toBe("partial");
    expect(store.finished?.output).toEqual({ sourceRunId: "up-1", answerLength: 0 });
  });

  it("fails when declared inputs are missing", async () => {
    const store = new MemoryStore();
    const out = await executeRun(store, registry, claimed({ stage: "dummy_summary", params: {}, attempt: 2, maxAttempts: 2 }));
    expect(out.outcome).toBe("failed");
    expect(store.finished?.error).toMatch(/Missing inputs from stage\(s\): dummy_priced_call/);
  });

  it("fails unknown stages and reports lost leases", async () => {
    const store = new MemoryStore();
    expect((await executeRun(store, registry, claimed({ stage: "nope" }))).outcome).toBe("failed");
    const lost = new MemoryStore();
    lost.ownsRun = false;
    expect((await executeRun(lost, registry, claimed())).outcome).toBe("lost");
  });
});
