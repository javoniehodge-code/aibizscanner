// Website stage 6: can each AI find and read the selected pages? Logic, plus all test stages with fake engines.
import { describe, expect, it } from "vitest";
import type { AnswerEngine, AskRequest, EngineIndex, ReadRequest } from "../../../answers";
import { MemoryStore } from "../../../engine.test-support";
import { executeRun, type Providers } from "../../../execute";
import { registry } from "../../../index";
import type { ClaimedRun, JsonValue, StageInput } from "../../../types";
import { combinedLabel } from "../test-stages";
import { pagePurpose, parseReadReply, readInstruction, readOutcome, searchOutcome, searchPrompt, targetKeys, verifiedPassages } from "../logic/findread";
import { excluded, pageKind, suggestPages } from "../logic/pages";
import { extractPage } from "../logic/extract";
import type { FindRead } from "../test-stages";

const BIZ = { name: "MVP Miami", location: "Miami, FL" };

describe("prompts", () => {
  it("builds a branded search prompt without the URL or page text, and a reading instruction with the URL only", () => {
    const faq = { kind: "faq", title: "FAQ's For Renting Exotic & Luxury Vehicles | MVP Miami Rentals", reason: "FAQ page" };
    expect(pagePurpose(faq)).toBe("FAQ's For Renting Exotic & Luxury Vehicles");
    expect(searchPrompt(BIZ, faq)).toBe('Find the official MVP Miami (Miami, FL) page about "FAQ\'s For Renting Exotic & Luxury Vehicles". Return the relevant official page and the sources used.');
    expect(searchPrompt(BIZ, { kind: "home", title: "Exotic Car Rentals | MVP Miami", reason: "Home page" })).toBe("Find the official website of MVP Miami (Miami, FL). Return the official page and the sources used.");
    expect(searchPrompt(BIZ, faq)).not.toContain("mvpmiami.com");
    expect(readInstruction("https://www.mvpmiami.com/faq/")).toContain("Open this official page: https://www.mvpmiami.com/faq/");
  });
});

describe("search outcome", () => {
  const keys = targetKeys(["https://www.mvpmiami.com/faq/", null]);
  it("is found when the page is cited or among the results (tracking parameters and www ignored)", () => {
    expect(searchOutcome({ sources: [], citations: ["https://mvpmiami.com/faq?utm_source=openai"], searchQueries: ["q"] }, keys)).toMatchObject({ status: "found", how: "cited" });
    expect(searchOutcome({ sources: ["https://www.mvpmiami.com/faq/"], citations: [], searchQueries: ["q"] }, keys)).toMatchObject({ status: "found", how: "result" });
  });
  it("doesn't let the home page or a third-party copy stand in for the page", () => {
    expect(searchOutcome({ sources: ["https://www.mvpmiami.com/", "https://www.yelp.com/biz/mvp-miami"], citations: [], searchQueries: ["q"] }, keys)).toMatchObject({ status: "not_found" });
  });
  it("is unconfirmed, not 'not found', when no search was observed", () => {
    expect(searchOutcome({ sources: [], citations: [], searchQueries: [] }, keys)).toMatchObject({ status: "unconfirmed" });
  });
});

describe("reading outcome", () => {
  const keys = targetKeys(["https://www.mvpmiami.com/faq/"]);
  const page = "Do I need insurance to rent a car from MVP Exotic Car Rentals? The renter must provide proof of an active insurance policy in their name. Deliveries are free within Miami-Dade.";
  const reply = parseReadReply('TITLE: FAQ\'s | MVP Miami\nPASSAGE 1: "The renter must provide proof of an active insurance policy"\nPASSAGE 2: "Deliveries are free within Miami-Dade."');
  const ok = [{ url: "https://www.mvpmiami.com/faq/", status: "success" as const, detail: null, retrievedAt: null, title: null, content: null }];

  it("parses the reply and checks passages word for word against the page (punctuation ignored)", () => {
    expect(reply).toEqual({ couldNotOpen: null, title: "FAQ's | MVP Miami", passages: ["The renter must provide proof of an active insurance policy", "Deliveries are free within Miami-Dade."] });
    expect(verifiedPassages(reply.passages, [page])).toEqual([true, true]);
    expect(verifiedPassages(["We offer free yacht parties"], [page])).toEqual([false]);
    expect(verifiedPassages(["free"], [page])).toEqual([false]); // too short to identify the page
  });
  it("is readable with two passages on the page, partly read with one", () => {
    expect(readOutcome(ok, reply, [true, true], keys).status).toBe("readable");
    expect(readOutcome(ok, reply, [true, false], keys).status).toBe("partial");
  });
  it("needs the tool's own attempt on this page: a model claiming it read the page isn't enough", () => {
    expect(readOutcome([], reply, [true, true], keys).status).toBe("unconfirmed");
    expect(readOutcome([{ ...ok[0]!, url: "https://www.mvpmiami.com/" }], reply, [true, true], keys)).toMatchObject({ status: "unconfirmed", reason: expect.stringContaining("other pages") });
  });
  it("is unsuccessful when the attempt failed, and unconfirmed when nothing it returned is on the page", () => {
    expect(readOutcome([{ ...ok[0]!, status: "error", detail: "url_not_accessible" }], reply, [false, false], keys)).toMatchObject({ status: "unsuccessful", reason: expect.stringContaining("url_not_accessible") });
    expect(readOutcome(ok, reply, [false, false], keys).status).toBe("unconfirmed");
  });
  it("labels the combination the way the design does", () => {
    expect(combinedLabel("found", "readable")).toBe("Found & read");
    expect(combinedLabel("not_found", "readable")).toBe("Read using direct link; not found in search");
    expect(combinedLabel("found", "partial")).toBe("Found; partly read");
    expect(combinedLabel("not_tested", "not_tested")).toBe("Not tested");
  });
});

describe("page choice fixes (MVP Miami, 17 Nov 2026)", () => {
  it("doesn't call a car page that starts with 'reserve' a booking page", () => {
    expect(pageKind("https://www.mvpmiami.com/reserve-a-bentley-flying-spur-rental-in-miami/")).toBe("other");
    expect(pageKind("https://a.com/reserve/")).toBe("booking");
    expect(pageKind("https://a.com/book-now")).toBe("booking");
    expect(excluded("https://a.com/reserve")).toBe(false);
  });
  it("doesn't match a service on one shared word", () => {
    const c = (url: string) => ({ url, kind: pageKind(url), sources: ["nav" as const], linkText: null });
    const s = suggestPages([c("https://www.mvpmiami.com/"), c("https://www.mvpmiami.com/luxury-yacht-rentals-miami/")], { services: ["Luxury Vehicle Rentals"], locations: [], cap: 12 });
    expect(s.map((x) => x.reason)).toEqual(["Home page", "In the site's navigation"]);
  });
  it("drops stray markup from the text of malformed pages", () => {
    expect(extractPage("<html><body><main><p>Hello</p>&lt;!DOCTYPE html&gt;<p>World</p></main></body></html>").text).toBe("Hello\nWorld");
  });
});

// ---------------------------------------------------------------------------------------------------------------
// Stages with fake engines
// ---------------------------------------------------------------------------------------------------------------

const SNAP_TEXT = "Do I need insurance? The renter must provide proof of an active insurance policy in their name. Deliveries are free within Miami-Dade county.";

function fakeEngine(engine: EngineIndex, mode: "good" | "hallucinate" | "blocked"): AnswerEngine {
  const usage = { tokensIn: 1000, tokensOut: 200, searchCalls: 1, requests: 1 };
  return {
    engine,
    provider: "fake",
    model: `fake-${engine}`,
    settings: {},
    estimate: () => usage,
    estimateRead: () => usage,
    async ask(r: AskRequest) {
      const found = mode === "good" && r.question.includes("Frequently");
      return { status: "ok", text: "Here it is.", citations: found ? ["https://mvpmiami.com/faq?utm_source=x"] : ["https://www.yelp.com/biz/mvp"], searchQueries: ["mvp miami faq"], sources: ["https://www.mvpmiami.com/"], usage, raw: null, requestId: null, servedModel: `fake-${engine}` };
    },
    async readPage(r: ReadRequest) {
      if (mode === "blocked") return { status: "ok", text: "COULD NOT OPEN: 403", attempts: [{ url: r.url, status: "error", detail: "url_not_accessible", retrievedAt: null, title: null, content: null }], provenance: "unknown", usage, raw: null, requestId: null, servedModel: null };
      const attempts = mode === "good" ? [{ url: r.url, status: "success" as const, detail: null, retrievedAt: "2026-11-17T10:00:00Z", title: "FAQ", content: SNAP_TEXT }] : [];
      const text = mode === "good" ? 'TITLE: FAQ\nPASSAGE 1: "The renter must provide proof of an active insurance policy"\nPASSAGE 2: "Deliveries are free within Miami-Dade county."' : 'TITLE: FAQ\nPASSAGE 1: "MVP offers free champagne on every rental"\nPASSAGE 2: "Open 24 hours a day."';
      return { status: "ok", text, attempts, provenance: "unknown", usage, raw: null, requestId: null, servedModel: null };
    },
  };
}

async function run(stage: string, inputs: StageInput[], providers: Providers, store: MemoryStore) {
  const def = registry.get(stage)!;
  const claimed: ClaimedRun = { id: `${stage}-1`, reportId: "r1", stage, version: 1, attempt: 1, maxAttempts: def.maxAttempts, timeoutMs: def.timeoutMs, params: {}, inputRunIds: inputs.map((i) => i.runId), instructions: [] };
  store.inputs = inputs;
  store.finished = null;
  const outcome = await executeRun(store, registry, claimed, undefined, providers);
  return { outcome, input: { runId: claimed.id, stage, output: store.finished!.output, outputHash: null } as StageInput };
}

describe("find & read stages (fake engines)", () => {
  it("tests every page with each engine, keeps the tool's returned content as evidence, and combines the results", async () => {
    const store = new MemoryStore(5, 0, []);
    store.snapshots.push({ id: "ps-faq", reportId: "r1", stageRunId: "x", url: "https://www.mvpmiami.com/faq/", finalUrl: "https://www.mvpmiami.com/faq/", fetchMode: "raw", userAgent: "t", httpStatus: 200, contentHash: null, textHash: null, html: "<html/>", text: SNAP_TEXT, error: null, fetchedAt: "2026-11-17T09:00:00Z" });
    const i = (runId: string, stage: string, output: unknown): StageInput => ({ runId, stage, output: output as JsonValue, outputHash: null });
    const set = i("set", "ws_page_set", { pageSet: { id: "00000000-0000-4000-8000-000000000009", version: 1, approvedAt: "2026-11-17T09:00:00Z" }, website: "https://www.mvpmiami.com/", business: BIZ, pages: [{ url: "https://www.mvpmiami.com/faq/", kind: "faq", reason: "FAQ page" }] });
    const page = { url: "https://www.mvpmiami.com/faq/", kind: "faq", reason: "FAQ page", snapshotId: "ps-faq", finalUrl: "https://www.mvpmiami.com/faq/", status: 200, error: null, truncated: false, title: "Frequently Asked Questions | MVP Miami", description: null, canonical: null, metaRobots: null, headings: [], wordCount: 20, textExcerpt: "", jsonLdTypes: [], jsonLdErrors: 0, microdataTypes: [], permissions: {} };
    const snap = i("snap", "ws_snapshot", { robots: { url: "https://www.mvpmiami.com/robots.txt", status: 200, registryVersion: "x" }, pages: [page] });

    const engines: Record<EngineIndex, AnswerEngine | null> = { 0: fakeEngine(0, "good"), 1: fakeEngine(1, "blocked"), 2: fakeEngine(2, "hallucinate") };
    const providers: Providers = { answers: (e) => engines[e] };
    const outs: StageInput[] = [];
    for (const s of ["ws_search_chatgpt", "ws_search_claude", "ws_search_gemini", "ws_read_chatgpt", "ws_read_claude", "ws_read_gemini"]) outs.push((await run(s, [set, snap], providers, store)).input);

    const reads = outs.slice(3).map((o) => (o.output as { pages: { status: string; passages: { onPage: boolean }[]; evidenceSnapshotId: string | null }[] }).pages[0]!);
    expect(reads.map((r) => r.status)).toEqual(["readable", "unsuccessful", "unconfirmed"]);
    expect(reads[0]!.passages.map((p) => p.onPage)).toEqual([true, true]);
    expect(reads[2]!.passages.map((p) => p.onPage)).toEqual([false, false]); // invented passages never count
    // The provider tool's content is stored as an engine_tool snapshot, separate from our own fetch.
    const tool = store.snapshots.find((x) => x.id === reads[0]!.evidenceSnapshotId)!;
    expect(tool).toMatchObject({ fetchMode: "engine_tool", engine: "chatgpt", text: SNAP_TEXT });
    expect(reads[2]!.evidenceSnapshotId).toBeNull(); // no tool attempt, nothing to store

    const fr = await run("ws_findread", [snap, ...outs], providers, store);
    const f = fr.input.output as unknown as FindRead;
    expect(f.pages[0]!.results.map((r) => r.label)).toEqual(["Found & read", "Not found or read; reason not confirmed", "Not found in search; reading unconfirmed"]);
    expect(f.foundAndRead).toEqual([1, 0, 0]);
    expect(f.selectedPageCount).toBe(1);
  });

  it("marks everything not tested when an engine isn't configured, and refuses a page list approved before the tests existed", async () => {
    const store = new MemoryStore(5, 0, []);
    const i = (runId: string, stage: string, output: unknown): StageInput => ({ runId, stage, output: output as JsonValue, outputHash: null });
    const page = { url: "https://a.com/", kind: "home", reason: "Home page", snapshotId: null, finalUrl: null, status: null, error: "x", truncated: false, title: null, description: null, canonical: null, metaRobots: null, headings: [], wordCount: 0, textExcerpt: "", jsonLdTypes: [], jsonLdErrors: 0, microdataTypes: [], permissions: {} };
    const snap = i("snap", "ws_snapshot", { robots: { url: "https://a.com/robots.txt", status: 404, registryVersion: "x" }, pages: [page] });
    const set = { pageSet: { id: "00000000-0000-4000-8000-000000000009", version: 1, approvedAt: "x" }, website: "https://a.com/", pages: [{ url: "https://a.com/", kind: "home", reason: "Home page" }] };
    const r = await run("ws_read_claude", [i("set", "ws_page_set", { ...set, business: BIZ }), snap], {}, store);
    expect((r.input.output as { pages: { status: string; reason: string }[] }).pages[0]).toMatchObject({ status: "not_tested", reason: "Claude is not configured (its API key is not set)" });
    const old = await run("ws_search_claude", [i("set", "ws_page_set", set), snap], {}, store);
    expect(old.outcome.outcome).toBe("failed");
  });
});
