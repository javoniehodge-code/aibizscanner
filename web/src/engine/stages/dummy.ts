import { z } from "zod";
import type { JsonObject, StageDefinition } from "../types";

/**
 * Milestone 1 dummy stages. They prove the queue, retries, timeouts, spending cap, cost logging and stale marking
 * end to end without calling any real AI API. The "provider" is a fake price list row (dummy / fake-model-1).
 */

const pricedCallParams = z.object({
  tokensIn: z.number().int().min(0).max(1_000_000).default(1200),
  tokensOut: z.number().int().min(0).max(1_000_000).default(300),
  searchCalls: z.number().int().min(0).max(100).default(1),
  /** Fail this many attempts before succeeding, to demonstrate retries with backoff. */
  failAttempts: z.number().int().min(0).max(10).default(0),
  /** Simulated provider latency. */
  delayMs: z.number().int().min(0).max(30_000).default(250),
});

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) return reject(signal.reason);
    const t = setTimeout(resolve, ms);
    signal.addEventListener(
      "abort",
      () => {
        clearTimeout(t);
        reject(signal.reason);
      },
      { once: true },
    );
  });
}

export const dummyPricedCall: StageDefinition = {
  id: "dummy_priced_call",
  label: "Dummy: fake priced call",
  inputs: [],
  timeoutMs: 20_000,
  maxAttempts: 3,
  parseParams: (raw) => pricedCallParams.parse(raw ?? {}) as JsonObject,
  async run(ctx) {
    const p = pricedCallParams.parse(ctx.params);
    const usage = { tokensIn: p.tokensIn, tokensOut: p.tokensOut, searchCalls: p.searchCalls, requests: 1 };
    const answer = await ctx.paidCall({ provider: "dummy", model: "fake-model-1", estimate: usage }, async (signal) => {
      await sleep(p.delayMs, signal);
      if (ctx.attempt <= p.failAttempts) throw new Error(`Simulated provider error on attempt ${ctx.attempt}`);
      return { result: "Fake answer from the dummy stage. No AI API was called.", usage };
    });
    return { status: "done", output: { answer, usage } };
  },
};

export const dummySummary: StageDefinition = {
  id: "dummy_summary",
  label: "Dummy: summarize the fake answer (reads dummy_priced_call)",
  inputs: ["dummy_priced_call"],
  timeoutMs: 10_000,
  maxAttempts: 2,
  parseParams: () => ({}),
  async run(ctx) {
    const input = ctx.inputs["dummy_priced_call"];
    if (!input) throw new Error("dummy_priced_call output missing");
    const output = input.output as { answer?: unknown } | null;
    const answer = typeof output?.answer === "string" ? output.answer : "";
    return {
      status: answer ? "done" : "partial",
      output: { sourceRunId: input.runId, answerLength: answer.length },
    };
  },
};
