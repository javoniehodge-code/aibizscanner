// Distinctive: each AI describes the business from the website only (no tools), one model call finds the reasons to
// choose the pages support (quotes checked in plain code) and flags the answers; then the report part.
import { describe, expect, it } from "vitest";
import { websiteDistinctive } from "@/report/schema";
import type { AnswerEngine, OfflineRequest } from "../../../answers";
import { MemoryStore } from "../../../engine.test-support";
import { executeRun, type Providers } from "../../../execute";
import { registry } from "../../../index";
import { instructionRef } from "../../../llm";
import { FakeLlmClient } from "../../../testing/fake-llm";
import type { ClaimedRun, JsonValue, StageInput } from "../../../types";
import { buildDistinctive } from "../../website/logic/section";
import { distinctiveQuestions, parseDistinctive, type DistinctiveScore } from "../distinctive";

const HOME = "MVP Miami rents exotic cars in Miami. We own our fleet, so the car you book is the car you drive. Free delivery anywhere in Miami-Dade between 10am and 8pm.";
const FAQ = "We also rent luxury yachts and villas. Renters must be 18 years or older with full coverage insurance.";
const BUNDLE = {
  version: "x",
  business: { name: "MVP Miami", location: "Miami", category: "Exotic Car Rentals" },
  standard: { id: "car-rental", version: "1.0", label: "Car rental", facts: [] },
  pages: [
    { ref: "P1", url: "https://www.mvpmiami.com/", name: "Home page", text: HOME, words: 30, truncated: false, source: "browser" },
    { ref: "P2", url: "https://www.mvpmiami.com/faq/", name: "FAQ", text: FAQ, words: 18, truncated: false, source: "plain" },
  ],
  leftOut: [],
};

const reply = (description: string, a: Record<string, string>) =>
  JSON.stringify({ description, answers: ["offer", "best-for", "why-choose", "alternative", "limits"].map((id) => ({ id, answer: a[id] ?? "NOT STATED" })) });

function fakeEngine(engine: 0 | 1 | 2, text: string, seen: OfflineRequest[] = []): AnswerEngine {
  const usage = { tokensIn: 2000, tokensOut: 300, searchCalls: 0, requests: 1 };
  return {
    engine, provider: "fake", model: `fake-${engine}`, settings: {},
    estimate: () => usage,
    async ask() { throw new Error("no search in this test"); },
    estimateOffline: () => usage,
    async answerOffline(r) { seen.push(r); return { status: "ok", text, usage, raw: null, requestId: null, servedModel: `fake-${engine}` }; },
  };
}

async function run(store: MemoryStore, stage: string, inputs: StageInput[], providers: Providers) {
  const def = registry.get(stage)!;
  store.inputs = inputs;
  store.finished = null;
  const claimed: ClaimedRun = { id: `${stage}-1`, reportId: "r1", stage, version: 1, attempt: 1, maxAttempts: def.maxAttempts, timeoutMs: def.timeoutMs, params: {}, inputRunIds: inputs.map((i) => i.runId), instructions: await Promise.all((def.instructions ?? []).map(instructionRef)) };
  const outcome = await executeRun(store, registry, claimed, undefined, providers);
  return { outcome, input: { runId: claimed.id, stage, output: (store.finished as { output: JsonValue } | null)?.output ?? null, outputHash: null } as StageInput };
}

describe("Distinctive", () => {
  it("asks the five neutral questions, naming the business and the kind of competitor", () => {
    expect(distinctiveQuestions({ name: "MVP Miami" }, "rental company").map((q) => q.question)).toEqual([
      "What does MVP Miami offer?",
      "Who is it best for?",
      "Why would someone choose it?",
      "When would another rental company be better?",
      "What are its limits?",
    ]);
    expect(parseDistinctive('```json\n{"description":"An exotic car rental.","answers":[{"id":"offer","answer":"Cars"}]}\n```', ["offer"])).toEqual({ description: "An exotic car rental.", answers: { offer: "Cars" } });
    expect(parseDistinctive("no json", ["offer"])).toBeNull();
  });

  it("collects each AI's website-only answers, keeps only reasons the pages support, flags answers, and builds the report part", async () => {
    const store = new MemoryStore(5, 0, []);
    const bundle: StageInput = { runId: "b", stage: "cc_bundle", output: BUNDLE as unknown as JsonValue, outputHash: null };
    const seen: OfflineRequest[] = [];
    const engines: Record<0 | 1 | 2, AnswerEngine> = {
      0: fakeEngine(0, reply("MVP Miami specializes in exotic car rentals in Miami, and is perfect for visitors who want delivery.", { offer: "Exotic cars, yachts and villas.", "why-choose": "It owns its fleet and delivers free in Miami-Dade." }), seen),
      1: fakeEngine(1, reply("MVP Miami rents exotic cars in Miami.", { offer: "Exotic car rentals.", "why-choose": "Great service and the best prices in town." })),
      2: fakeEngine(2, reply("MVP Miami rents exotic cars.", { offer: "Exotic cars with free airport limo service.", "why-choose": "Free delivery." })),
    };
    const ans: StageInput[] = [];
    for (const s of ["ds_answer_chatgpt", "ds_answer_claude", "ds_answer_gemini"]) ans.push((await run(store, s, [bundle], { answers: (e) => engines[e] })).input);
    expect(seen[0]!.instruction).toContain('answer exactly "NOT STATED"');
    expect(JSON.parse(seen[0]!.material).questions).toHaveLength(5);

    const judge = new FakeLlmClient(() =>
      JSON.stringify({
        reasons: [
          { name: "Owns its fleet", quotes: [{ ref: "P1", text: "We own our fleet, so the car you book is the car you drive" }] },
          { name: "Free delivery in Miami-Dade", quotes: [{ ref: "P1", text: "Free delivery anywhere in Miami-Dade between 10am and 8pm" }] },
          { name: "Yachts and villas too", quotes: [{ ref: "P2", text: "We also rent luxury yachts and villas" }] },
          { name: "Lowest prices", quotes: [{ ref: "P1", text: "The lowest prices in all of Florida guaranteed" }] }, // not on the page
        ],
        flags: [
          { engine: 1, id: "why-choose", flag: "generic", claim: null, note: "no specific reason" },
          { engine: 2, id: "offer", flag: "unsupported", claim: "free airport limo service", note: "" },
          // Blames words that are on the FAQ page: overruled in plain code.
          { engine: 0, id: "offer", flag: "unsupported", claim: "yachts and villas", note: "" },
          // No words to blame: overruled.
          { engine: 0, id: "why-choose", flag: "unsupported", claim: null, note: "everything here is supported" },
        ],
        mentions: [{ engine: 0, reasons: [0, 1, 2] }, { engine: 1, reasons: [] }, { engine: 2, reasons: [1, 3] }],
        fixes: [{ title: "Lead with your own fleet", text: "Say on your home page that you own every car, so the car booked is the car delivered." }],
      }),
    );
    const sc = (await run(store, "ds_score", [bundle, ...ans], { llm: judge })).input.output as unknown as DistinctiveScore;
    expect(sc.reasons.map((r) => [r.name, r.mentionedBy])).toEqual([["Owns its fleet", [0]], ["Free delivery in Miami-Dade", [0, 2]], ["Yachts and villas too", [0]]]);
    expect(sc.rejectedReasons).toBe(1);
    const q = (id: string) => sc.questions.find((x) => x.id === id)!.answers.map((a) => a.flag);
    expect(q("offer")).toEqual(["ok", "ok", "unsupported"]);
    expect(sc.questions.find((x) => x.id === "offer")!.answers[0]).toMatchObject({ flag: "ok", overruled: "unsupported" });
    expect(q("why-choose")).toEqual(["ok", "generic", "ok"]);
    expect(q("limits")).toEqual(["not_stated", "not_stated", "not_stated"]);

    const part = websiteDistinctive.parse(buildDistinctive(sc));
    expect(part.descriptions[0].v).toMatch(/^MVP Miami specializes in exotic car rentals/);
    expect(part.questions[0]!.answers[2].v.flag).toBe("Not on your website: free airport limo service.");
    expect(part.questions[2]!.answers[1].v.flag).toBe("Generic: could describe any rental company (no specific reason).");
    expect(part.takeaways.map((t) => t.v.k)).toEqual([
      "Owns its fleet: easy to miss",
      "Free delivery in Miami-Dade: easy to miss",
      "AI added things your site doesn't say",
      "What sets you apart isn't established",
    ]);
    expect(part.takeaways[0]!.v.v).toBe("ChatGPT finds it; Claude and Gemini don't.");
  });
});
