// Processing test of the whole prompt-analysis chain with fake providers: prompt set -> three engines -> reading ->
// assembly. Checks wiring, failure handling and that the result is a valid report section. No real API is called.
import { describe, expect, it } from "vitest";
import type { AnswerEngine, AskRequest, EngineIndex } from "../../../answers";
import { MemoryStore } from "../../../engine.test-support";
import { executeRun, type Providers } from "../../../execute";
import { instructionRef } from "../../../llm";
import { FakeLlmClient } from "../../../testing/fake-llm";
import type { ClaimedRun, JsonValue, StageInput } from "../../../types";
import { registry } from "../../../index";
import type { AnswerExtraction, PromptSetSpec } from "../schemas";

const SET: PromptSetSpec = {
  promptSet: { id: "00000000-0000-4000-8000-000000000001", version: 1, approvedAt: "2026-11-13T10:00:00Z" },
  target: { name: "MVP Miami", aliases: ["MVP Miami Rentals"], domains: ["mvpmiami.com"], location: "Miami, FL", category: "Luxury rentals" },
  location: { city: "Miami", region: "Florida", country: "US", timezone: "America/New_York" },
  groups: [{ name: "Baseline", description: "General category questions" }],
  prompts: [
    { id: "P1", group: 0, demand: "Observed demand", text: "Best exotic car rental companies in Miami" },
    { id: "P2", group: 0, demand: "Observed demand", text: "Where can I rent a yacht in Miami?" },
  ],
};

const ANSWER = "My top pick is MVP Miami for supercars, with same-day delivery. Prestige Rentals is also popular (4.7 stars on Yelp).";
const EXTRACTION: AnswerExtraction = {
  businesses: [
    { name: "MVP Miami", status: "recommended", quote: "My top pick is MVP Miami", reason: "with same-day delivery" },
    { name: "Prestige Rentals", status: "mentioned", quote: "Prestige Rentals is also popular", reason: null },
  ],
  grouped: false,
  firstChoice: { name: "MVP Miami", scope: "supercars", quote: "My top pick is MVP Miami for supercars" },
  namedSources: [{ source: "Yelp", quote: "4.7 stars on Yelp" }],
};

function fakeEngine(engine: EngineIndex, behave: (r: AskRequest) => "ok" | "fail" | "refuse" = () => "ok"): AnswerEngine {
  return {
    engine,
    provider: "fake",
    model: `fake-${engine}`,
    settings: { tool: "web_search" },
    estimate: () => ({ tokensIn: 1000, tokensOut: 500, searchCalls: 2, requests: 1 }),
    async ask(r) {
      const how = behave(r);
      if (how === "fail") throw new Error("provider exploded");
      const usage = { tokensIn: 900, tokensOut: 300, searchCalls: 1, requests: 1 };
      if (how === "refuse") return { status: "refused", text: "", citations: [], searchQueries: [], usage, raw: null, requestId: null, servedModel: null };
      return {
        status: "ok",
        text: ANSWER,
        citations: ["https://www.mvpmiami.com/fleet?utm_source=x", "https://www.yelp.com/biz/prestige"],
        searchQueries: ["exotic car rental miami"],
        usage,
        raw: { id: "resp" },
        requestId: "req-1",
        servedModel: `fake-${engine}-2026`,
      };
    },
  };
}

let seq = 0;
async function run(stage: string, inputs: StageInput[], providers: Providers, params: Record<string, JsonValue> = {}, cap = 5) {
  const def = registry.get(stage)!;
  const run: ClaimedRun = {
    id: `${stage}-${++seq}`,
    reportId: "r1",
    stage,
    version: 1,
    attempt: 1,
    maxAttempts: def.maxAttempts,
    timeoutMs: def.timeoutMs,
    params: def.parseParams(params),
    inputRunIds: inputs.map((i) => i.runId),
    instructions: await Promise.all((def.instructions ?? []).map(instructionRef)),
  };
  const store = new MemoryStore(cap, 0, inputs);
  const outcome = await executeRun(store, registry, run, undefined, providers);
  const input: StageInput = { runId: run.id, stage, output: store.finished?.output ?? null, outputHash: store.finished?.outputHash ?? null };
  return { outcome, store, input };
}

describe("prompt analysis pipeline (fake providers)", () => {
  it("runs end to end into a valid promptAnalysis section, with failures shown as unavailable", async () => {
    const engines: Record<EngineIndex, AnswerEngine | null> = {
      0: fakeEngine(0),
      1: fakeEngine(1, (r) => (r.question.includes("yacht") ? "fail" : "ok")),
      2: null, // Gemini key not set
    };
    const llm = new FakeLlmClient(() => JSON.stringify(EXTRACTION));
    const providers: Providers = { llm, answers: (e) => engines[e] };

    const set = await run("pa_prompt_set", [], providers, SET as unknown as Record<string, JsonValue>);
    expect(set.outcome.outcome).toBe("done");

    const a0 = await run("pa_answers_chatgpt", [set.input], providers);
    const a1 = await run("pa_answers_claude", [set.input], providers);
    const a2 = await run("pa_answers_gemini", [set.input], providers);
    expect([a0.outcome.outcome, a1.outcome.outcome, a2.outcome.outcome]).toEqual(["done", "partial", "partial"]);
    expect(a0.store.usage).toHaveLength(2);
    expect(a2.store.usage).toHaveLength(0);
    // Every answer, including failures and unconfigured engines, is stored as evidence with the provider response.
    expect(a0.store.engineAnswers.map((r) => [r.engine, r.promptId, r.status])).toEqual([["chatgpt", "P1", "ok"], ["chatgpt", "P2", "ok"]]);
    expect(a0.store.engineAnswers[0]).toMatchObject({ promptSetId: SET.promptSet.id, rawResponse: { id: "resp" }, citations: [{ url: "https://www.mvpmiami.com/fleet?utm_source=x" }, { url: "https://www.yelp.com/biz/prestige" }] });
    expect(a2.store.engineAnswers).toHaveLength(2);
    expect((a1.input.output as { answers: { status: string; error: string | null }[] }).answers[1]).toMatchObject({ status: "error", error: "provider exploded" });

    const ex = await run("pa_extract", [set.input, a0.input, a1.input, a2.input], providers);
    expect(ex.outcome.outcome).toBe("done");
    expect(llm.requests).toHaveLength(3); // 2 ChatGPT + 1 Claude usable answers
    expect(llm.requests[0]?.user).toContain("untrusted");
    expect(ex.store.llmCalls.every((c) => c.valid && c.instruction.id === "prompt-analysis/extract-answer")).toBe(true);

    const asm = await run("pa_assemble", [set.input, a0.input, a1.input, a2.input, ex.input], providers);
    expect(asm.outcome.outcome).toBe("partial");
    const out = asm.input.output as {
      section: { run: { v: { prompts: number; expected: number; usable: number; unavailable: number } }; businesses: { v: { key: string } }[]; pages: { v: { key: string; category: string } }[]; firstChoices: unknown[]; questions: { answers: { v: { status: string; reason?: string } }[] }[] };
      business: { key: string };
      evidence: Record<string, unknown>;
    };
    expect(out.section.run.v).toMatchObject({ prompts: 2, expected: 6, usable: 3, unavailable: 3 });
    expect(out.business.key).toBe("MM");
    expect(out.section.businesses.map((b) => b.v.key)).toEqual(["MM", "PR"]);
    expect(out.section.pages.map((p) => [p.v.key, p.v.category])).toEqual([["yw", "your"], ["rv1", "review"]]);
    expect(out.section.firstChoices).toHaveLength(3);
    expect(out.section.questions[0]!.answers[2]!.v).toMatchObject({ status: "unavailable", reason: "Gemini is not configured (its API key is not set)" });
    expect(out.evidence["ans-0-P1"]).toBeDefined();
  });

  it("an extraction whose quotes aren't in the answer is retried, then the answer is shown as unavailable", async () => {
    const providers: Providers = {
      llm: new FakeLlmClient(() => JSON.stringify({ ...EXTRACTION, firstChoice: { name: "MVP Miami", scope: "Overall", quote: "the very best in Florida" } })),
      answers: (e) => (e === 0 ? fakeEngine(0) : null),
    };
    const set = await run("pa_prompt_set", [], providers, SET as unknown as Record<string, JsonValue>);
    const a = await Promise.all(["pa_answers_chatgpt", "pa_answers_claude", "pa_answers_gemini"].map((s) => run(s, [set.input], providers)));
    const ex = await run("pa_extract", [set.input, ...a.map((x) => x.input)], providers);
    expect(ex.outcome.outcome).toBe("failed");
    expect(ex.store.finished?.error).toMatch(/No answer could be read: quoted words not found/);
    expect(ex.store.llmCalls).toHaveLength(4); // 2 answers x 2 attempts
  });

  it("stops asking once the spending cap is reached and keeps the answers already paid for", async () => {
    const providers: Providers = { answers: (e) => (e === 0 ? fakeEngine(0) : null) };
    const set = await run("pa_prompt_set", [], providers, SET as unknown as Record<string, JsonValue>);
    // Each call is estimated at $0.022 and costs $0.0156 (test pricing); a $0.03 cap allows exactly one.
    const a0 = await run("pa_answers_chatgpt", [set.input], providers, {}, 0.03);
    expect(a0.outcome.outcome).toBe("partial");
    const answers = (a0.input.output as { answers: { status: string; error: string | null }[] }).answers;
    // Both questions are asked concurrently; the in-flight reservation lets only one through.
    expect(answers.map((x) => x.status).sort()).toEqual(["error", "ok"]);
    expect(answers.find((x) => x.status === "error")?.error).toMatch(/Spending cap reached/);
    expect(a0.store.usage).toHaveLength(1);
  });

  it("after a rate limit, the next attempt asks only the questions still unanswered", async () => {
    let limited = true;
    const asked: string[] = [];
    const engine = fakeEngine(0);
    const limitedEngine: AnswerEngine = {
      ...engine,
      async ask(r, signal) {
        asked.push(r.question);
        if (limited && r.question.includes("yacht")) throw Object.assign(new Error("429 Rate limit reached for gpt-6.1-sol"), { status: 429 });
        return engine.ask(r, signal);
      },
    };
    const providers: Providers = { answers: (e) => (e === 0 ? limitedEngine : null) };
    const set = await run("pa_prompt_set", [], providers, SET as unknown as Record<string, JsonValue>);

    const def = registry.get("pa_answers_chatgpt")!;
    const store = new MemoryStore(5, 0, [set.input]);
    const base: ClaimedRun = {
      id: "chatgpt-run",
      reportId: "r1",
      stage: def.id,
      version: 1,
      attempt: 1,
      maxAttempts: def.maxAttempts,
      timeoutMs: def.timeoutMs,
      params: {},
      inputRunIds: [set.input.runId],
      instructions: [],
    };
    const first = await executeRun(store, registry, base, undefined, providers);
    expect(first.outcome).toBe("retry");
    expect(store.retried?.error).toMatch(/ChatGPT: 1 of 2 answered so far; 1 left because of the provider's rate limit/);
    expect(store.engineAnswers.map((a) => [a.promptId, a.status])).toEqual([["P1", "ok"]]);

    limited = false;
    asked.length = 0;
    const second = await executeRun(store, registry, { ...base, attempt: 2 }, undefined, providers);
    expect(second.outcome).toBe("done");
    expect(asked).toEqual([SET.prompts[1]!.text]); // P1 was not asked (or paid for) again
    const out = store.finished?.output as { answers: { promptId: string; answerId: string; status: string }[] };
    expect(out.answers.map((a) => [a.promptId, a.status])).toEqual([["P1", "ok"], ["P2", "ok"]]);
    expect(out.answers[0]?.answerId).toBe(store.engineAnswers[0]?.id);
    expect(store.usage.filter((u) => u.succeeded)).toHaveLength(2);
  });

  it("an unknown model fails the step at once instead of retrying", async () => {
    const notFound: AnswerEngine = {
      ...fakeEngine(2),
      async ask() {
        throw new Error('{"error":{"code":404,"message":"models/x is not found for API version v1","status":"NOT_FOUND"}}');
      },
    };
    const providers: Providers = { answers: (e) => (e === 2 ? notFound : null) };
    const set = await run("pa_prompt_set", [], providers, SET as unknown as Record<string, JsonValue>);
    const g = await run("pa_answers_gemini", [set.input], providers);
    expect(g.outcome.outcome).toBe("failed");
    expect(g.store.retried).toBeNull();
    expect(g.store.finished?.error).toMatch(/No Gemini answers: .*not found/);
  });

  it("refuses a prompt set with a question in an unknown group", () => {
    const bad = { ...SET, prompts: [{ ...SET.prompts[0]!, group: 3 }] };
    expect(() => registry.get("pa_prompt_set")!.parseParams(bad)).toThrow(/group out of range/);
  });
});
