// Clear & complete: the page bundle, our website assessment (quotes checked in plain code), each AI's website-only
// answers (no tools) and the scores, with fake models; then the report part.
import { describe, expect, it } from "vitest";
import { websiteClear } from "@/report/schema";
import type { AnswerEngine, OfflineRequest } from "../../../answers";
import { MemoryStore } from "../../../engine.test-support";
import { executeRun, type Providers } from "../../../execute";
import { registry } from "../../../index";
import { instructionRef } from "../../../llm";
import { FakeLlmClient } from "../../../testing/fake-llm";
import type { ClaimedRun, JsonValue, StageInput } from "../../../types";
import { buildClear } from "../../website/logic/section";
import { buildBundle, cutWords, isNotStated, parseAnswers, quoteOnPage, resolveWebsiteStatus } from "../logic";
import type { ContentScore } from "../stages";
import { standardFor, STANDARDS } from "../standards";

const URL1 = "https://www.mvpmiami.com/";
const URL2 = "https://www.mvpmiami.com/faq/";
const HOME_TEXT = "Exotic car rentals in Miami. Rent a Lamborghini Huracan, Rolls-Royce Cullinan or Ferrari F8 today. Call 786.877.4317 to book or use our online reservation form. We deliver anywhere in Miami-Dade and Broward.";
const FAQ_TEXT = "Renters must be 25 years or older with a valid driver's license and full coverage insurance. The deposit amount is specific to each vehicle and can range anywhere from $1,000 – $7,000. We also rent luxury yachts and villas.";

describe("decision-fact standards", () => {
  it("finds the approved list from the business category, and none for an unknown one", () => {
    expect(standardFor("Exotic Car Rentals")?.id).toBe("car-rental");
    expect(standardFor("Boutique hotel")?.id).toBe("boutique-hotel");
    expect(standardFor("Moving company")).toBeNull();
    for (const s of STANDARDS) {
      expect(s.facts.length).toBeGreaterThanOrEqual(5);
      expect(s.facts.length).toBeLessThanOrEqual(10);
    }
    expect(standardFor("Exotic Car Rentals")!.facts.map((f) => [f.bucket, f.name])).toEqual([
      ["core", "Vehicles available"],
      ["core", "Prices and what's included"],
      ["core", "Rental requirements"],
      ["core", "Deposit and payment"],
      ["core", "Delivery, pickup and areas served"],
      ["core", "How to book and contact"],
      ["relevant", "Chauffeur or driver option"],
      ["relevant", "Cancellation and changes"],
      ["relevant", "Other services"],
    ]);
  });
});

describe("plain-code checks", () => {
  const pages = buildBundle([
    { url: URL1, name: "Home page", text: HOME_TEXT, source: "browser" },
    { url: URL2, name: "FAQ", text: FAQ_TEXT, source: "plain" },
    { url: "https://x.com/empty", name: "Empty", text: null, source: "plain" },
  ]);

  it("bundles pages with refs, and leaves out pages with no text", () => {
    expect(pages.pages.map((p) => [p.ref, p.name, p.source])).toEqual([["P1", "Home page", "browser"], ["P2", "FAQ", "plain"]]);
    expect(pages.leftOut).toEqual(["https://x.com/empty"]);
    expect(cutWords("a b c d e", 3)).toEqual({ text: "a b c", words: 3, truncated: true });
  });

  it("accepts a quote only when it is on the page it names", () => {
    expect(quoteOnPage({ ref: "P2", text: "Renters must be 25 years or older" }, pages.pages)).toBe(true);
    expect(quoteOnPage({ ref: "P1", text: "Renters must be 25 years or older" }, pages.pages)).toBe(false); // wrong page
    expect(quoteOnPage({ ref: "P2", text: "Renters must be 21 years or older" }, pages.pages)).toBe(false); // altered
  });

  it("needs a verified quote for a positive finding, and allows 'not applicable' only for When-relevant facts", () => {
    const [vehicles] = standardFor("car rental")!.facts;
    const chauffeur = standardFor("car rental")!.facts.find((f) => f.id === "chauffeur")!;
    expect(resolveWebsiteStatus(vehicles!, "enough", 1)).toBe("enough");
    expect(resolveWebsiteStatus(vehicles!, "enough", 0)).toBe("unverified");
    expect(resolveWebsiteStatus(vehicles!, "not_applicable", 0)).toBe("not_enough");
    expect(resolveWebsiteStatus(chauffeur, "not_applicable", 0)).toBe("not_applicable");
  });

  it("reads the AI's JSON answers, around code fences, and spots NOT STATED", () => {
    expect(parseAnswers('```json\n{"answers":[{"id":"vehicles","answer":"Lamborghini"},{"id":"zzz","answer":"x"}]}\n```', ["vehicles"])).toEqual({ vehicles: "Lamborghini" });
    expect(parseAnswers("I can't help", ["vehicles"])).toBeNull();
    expect([isNotStated("NOT STATED"), isNotStated("Not stated."), isNotStated(undefined), isNotStated("Lamborghini")]).toEqual([true, true, true, false]);
  });
});

// ---------------------------------------------------------------------------------------------------------------
// The four stages with fake models
// ---------------------------------------------------------------------------------------------------------------

const FACT_IDS = ["vehicles", "prices", "requirements", "deposit-payment", "delivery-locations", "booking-contact", "chauffeur", "cancellation", "other-services"];

/** Our assessor: vehicles, requirements, deposit, delivery, booking and other services are on the pages; prices claims a quote that isn't. */
function assessorReply(): string {
  const item = (id: string, status: string, provides: string, quotes: { ref: string; text: string }[], missing: string | null = null, fix: string | null = null) => ({ id, status, provides, missing, quotes, fix });
  return JSON.stringify({
    items: [
      item("vehicles", "enough", "Lists Lamborghini, Rolls-Royce and Ferrari models.", [{ ref: "P1", text: "Rent a Lamborghini Huracan, Rolls-Royce Cullinan or Ferrari F8 today" }]),
      item("prices", "partial", "Gives daily rates.", [{ ref: "P1", text: "Daily rates start at $999 per day" }], "What the rate includes.", "State what each daily rate includes."),
      item("requirements", "enough", "Age 25+, licence and full coverage insurance.", [{ ref: "P2", text: "Renters must be 25 years or older with a valid driver's license" }]),
      item("deposit-payment", "partial", "Deposit of $1,000 to $7,000 by vehicle.", [{ ref: "P2", text: "can range anywhere from $1,000 – $7,000" }], "How payment works.", "Say which payment methods you accept and when the deposit is returned."),
      item("delivery-locations", "enough", "Delivery anywhere in Miami-Dade and Broward.", [{ ref: "P1", text: "We deliver anywhere in Miami-Dade and Broward" }]),
      item("booking-contact", "enough", "Phone and online reservation form.", [{ ref: "P1", text: "Call 786.877.4317 to book or use our online reservation form" }]),
      item("chauffeur", "not_applicable", "Nothing", []),
      item("cancellation", "not_enough", "Nothing", [], "The cancellation policy.", "Add your cancellation and refund policy."),
      item("other-services", "enough", "Yachts and villas.", [{ ref: "P2", text: "We also rent luxury yachts and villas" }]),
    ],
  });
}

function fakeEngine(engine: 0 | 1 | 2, reply: (r: OfflineRequest) => string): AnswerEngine {
  const usage = { tokensIn: 3000, tokensOut: 400, searchCalls: 0, requests: 1 };
  return {
    engine, provider: "fake", model: `fake-${engine}`, settings: {},
    estimate: () => usage,
    async ask() { throw new Error("no search in this test"); },
    estimateOffline: () => usage,
    async answerOffline(r) { return { status: "ok", text: reply(r), usage, raw: null, requestId: null, servedModel: `fake-${engine}-served` }; },
  };
}
const answersJson = (a: Record<string, string>) => JSON.stringify({ answers: FACT_IDS.map((id) => ({ id, answer: a[id] ?? "NOT STATED" })) });

async function run(store: MemoryStore, stage: string, inputs: StageInput[], providers: Providers, params: Record<string, JsonValue> = {}) {
  const def = registry.get(stage)!;
  store.inputs = inputs;
  store.finished = null;
  const claimed: ClaimedRun = { id: `${stage}-1`, reportId: "r1", stage, version: 1, attempt: 1, maxAttempts: def.maxAttempts, timeoutMs: def.timeoutMs, params, inputRunIds: inputs.map((i) => i.runId), instructions: await Promise.all((def.instructions ?? []).map(instructionRef)) };
  const outcome = await executeRun(store, registry, claimed, undefined, providers);
  return { outcome, input: { runId: claimed.id, stage, output: (store.finished as { output: JsonValue } | null)?.output ?? null, outputHash: null } as StageInput };
}

describe("Clear & complete stages (fake models)", () => {
  it("assesses the website, asks each AI with tools off, scores the answers, and builds the report part", async () => {
    const store = new MemoryStore(5, 0, []);
    const snap = (id: string, url: string, mode: "raw" | "rendered", text: string | null, status = 200) =>
      store.snapshots.push({ id, reportId: "r1", stageRunId: "x", url, finalUrl: url, fetchMode: mode, userAgent: "t", httpStatus: status, contentHash: null, textHash: null, html: "<html/>", text, error: null, fetchedAt: "2026-11-17T17:07:00Z" });
    snap("b-home", URL1, "rendered", HOME_TEXT);
    snap("raw-faq", URL2, "raw", FAQ_TEXT);
    const i = (runId: string, stage: string, output: unknown): StageInput => ({ runId, stage, output: output as JsonValue, outputHash: null });
    const pg = (url: string, kind: string, title: string) => ({ url, kind, reason: "r", snapshotId: null, finalUrl: url, status: 403, error: "HTTP 403", truncated: false, title: null, description: null, canonical: null, metaRobots: null, headings: [], wordCount: 0, textExcerpt: "", jsonLdTypes: [], jsonLdErrors: 0, microdataTypes: [], permissions: {}, _t: title });
    const pages = [pg(URL1, "home", "Home"), pg(URL2, "faq", "FAQ's For Renting | MVP Miami")].map(({ _t, ...p }) => (void _t, p));
    const jsPage = (url: string, snapshotId: string | null, title: string) => ({ url, verdict: "same", label: "Readable", reason: "r", rendered: { snapshotId, status: snapshotId ? 200 : 403, finalUrl: url, error: snapshotId ? null : "HTTP 403", title, durationMs: 1, requests: { fetched: 1, refused: 0, skipped: 0 } }, raw: null, rawWords: 1, renderedWords: 1, addedWords: 0, removedWords: 0, onlyRendered: [], keyFactsOnlyRendered: [], answerKey: null });
    const up = [
      i("pa", "pa_prompt_set", { promptSet: { id: "00000000-0000-4000-8000-000000000001", version: 1, approvedAt: "x" }, target: { name: "MVP Miami", aliases: [], domains: ["mvpmiami.com"], location: "Miami", category: "Exotic Car Rentals" }, location: null, groups: [{ name: "g", description: "d" }], prompts: [{ id: "P1", group: 0, demand: "d", text: "t" }] }),
      i("set", "ws_page_set", { pageSet: { id: "00000000-0000-4000-8000-000000000009", version: 2, approvedAt: "x" }, website: URL1, business: { name: "MVP Miami", location: "Miami" }, pages: [{ url: URL1, kind: "home", reason: "Home page" }, { url: URL2, kind: "faq", reason: "FAQ" }] }),
      i("snap", "ws_snapshot", { robots: { url: `${URL1}robots.txt`, status: 200, registryVersion: "x" }, pages }),
      i("js", "ws_render", { version: "x", counts: { same: 2, minor: 0, content_needs_js: 0, key_facts_need_js: 0, not_checked: 0 }, pages: [jsPage(URL1, "b-home", "Home | MVP"), jsPage(URL2, null, "FAQ's For Renting | MVP Miami")] }),
    ];

    // 1. The bundle: the home page from our browser copy, the FAQ from our earlier plain copy (this run's was refused).
    const bundle = (await run(store, "cc_bundle", up, {})).input;
    const b = bundle.output as unknown as { standard: { id: string }; pages: { ref: string; name: string; source: string }[] };
    expect(b.standard.id).toBe("car-rental");
    expect(b.pages.map((p) => [p.ref, p.name, p.source])).toEqual([["P1", "Home page", "browser"], ["P2", "FAQ's For Renting", "plain"]]);

    // 2. Our assessment: the prices quote isn't on the page, so that finding can't be verified.
    const assessor = new FakeLlmClient(() => assessorReply());
    const baseRun = await run(store, "cc_baseline", [bundle], { llm: assessor });
    if (!baseRun.input.output) throw new Error(JSON.stringify(baseRun.outcome));
    const base = baseRun.input;
    const bf = (base.output as unknown as { facts: { id: string; status: string; rejectedQuotes: number }[] }).facts;
    expect(Object.fromEntries(bf.map((f) => [f.id, f.status]))).toMatchObject({ vehicles: "enough", prices: "unverified", "deposit-payment": "partial", chauffeur: "not_applicable", cancellation: "not_enough" });
    expect(bf.find((f) => f.id === "prices")!.rejectedQuotes).toBe(1);

    // 3. Each AI, website only. The request carries no tools: only an instruction and the page material.
    const seen: OfflineRequest[] = [];
    const engines: Record<0 | 1 | 2, AnswerEngine> = {
      0: fakeEngine(0, (r) => (seen.push(r), answersJson({ vehicles: "Lamborghini Huracan, Rolls-Royce Cullinan, Ferrari F8", requirements: "25 or older, licence, insurance", "booking-contact": "Call 786.877.4317" }))),
      1: fakeEngine(1, () => answersJson({ vehicles: "Lamborghini and Ferrari", requirements: "21 or older", cancellation: "Free cancellation up to 48 hours" })),
      2: fakeEngine(2, () => "Sorry, here is a summary instead."),
    };
    const providers: Providers = { answers: (e) => engines[e] };
    const ans = [];
    for (const s of ["cc_answer_chatgpt", "cc_answer_claude", "cc_answer_gemini"]) ans.push((await run(store, s, [bundle], providers)).input);
    expect(seen[0]!.instruction).toContain('answer exactly "NOT STATED"');
    expect(JSON.parse(seen[0]!.material).pages).toHaveLength(2);
    expect((ans[2]!.output as unknown as { status: string }).status).toBe("unreadable");

    // 4. Scores: NOT STATED handled in plain code; stated answers judged once against the same pages.
    const judge = new FakeLlmClient((req) => {
      const items = (JSON.parse(req.user.slice(req.user.indexOf("{"))) as { answers: { engine: number; id: string }[] }).answers.map((a) => ({
        engine: a.engine,
        id: a.id,
        verdict: a.engine === 1 && a.id === "requirements" ? "wrong" : a.engine === 1 && a.id === "cancellation" ? "unsupported" : a.engine === 1 && a.id === "vehicles" ? "partial" : "supported",
        reason: "r",
      }));
      return JSON.stringify({ items });
    });
    const score = (await run(store, "cc_score", [bundle, base, ...ans], { llm: judge })).input;
    expect(judge.requests).toHaveLength(1);
    const sc = score.output as unknown as ContentScore;
    const verdicts = (id: string) => sc.facts.find((f) => f.id === id)!.answers.map((a) => a.verdict);
    expect(verdicts("vehicles")).toEqual(["supported", "partial", "not_tested"]);
    expect(verdicts("requirements")).toEqual(["supported", "wrong", "not_tested"]);
    // The website doesn't give the cancellation policy: ChatGPT rightly said so; Claude invented one.
    expect(verdicts("cancellation")).toEqual(["correctly_not_stated", "unsupported", "not_tested"]);
    // The website gives delivery areas; ChatGPT said it doesn't.
    expect(verdicts("delivery-locations")[0]).toBe("not_answered");

    // The report part: not-applicable facts left out (and named in the rules), counts from the statuses.
    const part = websiteClear.parse(buildClear(sc));
    expect(part.facts.map((f) => f.v.name)).not.toContain("Chauffeur or driver option");
    expect(part.verdict.v.heading).toBe("Your website gives enough detail on 5 of 8 decision facts.");
    expect(part.facts.find((f) => f.v.name === "Cancellation and changes")!.v.cells.map((c) => c.value)).toEqual(["Not enough information", "Said your site doesn't say", "Not on your website", "Not tested"]);
    // Fixes: core facts first, then When-relevant ones.
    expect(part.fixes.map((f) => f.v.title)).toEqual(["Say which payment methods you accept and when the deposit is returned.", "Add your cancellation and refund policy."]);
    expect(part.rules[0]!.v.v).toContain("not applicable here: chauffeur or driver option");
  });

  it("stops with a clear message when no approved fact list fits the business", async () => {
    const store = new MemoryStore(5, 0, []);
    const i = (runId: string, stage: string, output: unknown): StageInput => ({ runId, stage, output: output as JsonValue, outputHash: null });
    const r = await run(store, "cc_bundle", [
      i("pa", "pa_prompt_set", { promptSet: { id: "00000000-0000-4000-8000-000000000001", version: 1, approvedAt: "x" }, target: { name: "B", aliases: [], domains: [], location: "NY", category: "Moving company" }, location: null, groups: [{ name: "g", description: "d" }], prompts: [{ id: "P1", group: 0, demand: "d", text: "t" }] }),
      i("set", "ws_page_set", { pageSet: { id: "00000000-0000-4000-8000-000000000009", version: 1, approvedAt: "x" }, website: "https://b.com/", pages: [{ url: "https://b.com/", kind: "home", reason: "Home page" }] }),
      i("snap", "ws_snapshot", { robots: { url: "https://b.com/robots.txt", status: 404, registryVersion: "x" }, pages: [] }),
      i("js", "ws_render", { version: "x", counts: { same: 0, minor: 0, content_needs_js: 0, key_facts_need_js: 0, not_checked: 0 }, pages: [] }),
    ], {});
    expect(r.outcome).toMatchObject({ outcome: "failed", error: expect.stringContaining('No approved decision-fact list for the category "Moving company"') });
  });
});
