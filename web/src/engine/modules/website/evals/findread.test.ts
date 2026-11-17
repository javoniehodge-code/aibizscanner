// Website stage 6: can each AI find and read the selected pages? Logic, plus all test stages with fake engines.
import { describe, expect, it } from "vitest";
import type { AnswerEngine, AskRequest, EngineIndex, ReadRequest } from "../../../answers";
import { MemoryStore } from "../../../engine.test-support";
import { executeRun, type PageRenderer, type Providers } from "../../../execute";
import { registry } from "../../../index";
import type { ClaimedRun, JsonValue, StageInput } from "../../../types";
import { combinedLabel } from "../test-stages";
import { hoursValue, pagePurpose, parseReadReply, priceValue, scoreExtraction, readInstruction, readOutcome, searchOutcome, searchPrompt, targetKeys, verifiedPassages } from "../logic/findread";
import { excluded, pageKind, suggestPages } from "../logic/pages";
import { extractPage } from "../logic/extract";
import type { FindRead } from "../test-stages";
import type { JsCheck } from "../js-stage";

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

describe("key-fact extraction", () => {
  it("asks for key facts without giving any, and parses them", () => {
    const instr = readInstruction("https://www.mvpmiami.com/rentals/");
    expect(instr).toContain("FACT: price | <price as written");
    expect(instr).not.toMatch(/\$\d/);
    const r = parseReadReply('TITLE: Rentals\nPASSAGE 1: "a b c d e"\nPASSAGE 2: "f g h i j"\nFACT: price | Lamborghini Huracan $1,495/day\n- FACT: phone | (305) 555-0100\nFACT: hours: 9am - 6pm daily\nFACT: item | Rolls-Royce Cullinan');
    expect(r.facts).toEqual([
      { kind: "price", text: "Lamborghini Huracan $1,495/day" },
      { kind: "phone", text: "(305) 555-0100" },
      { kind: "hours", text: "9am - 6pm daily" },
      { kind: "item", text: "Rolls-Royce Cullinan" },
    ]);
  });

  it("matches facts by value, whatever the wording or the kind the AI gave them", () => {
    expect([priceValue("$1,495.00/day"), priceValue("US$3,500 per hour"), priceValue("$99.5")]).toEqual(["1495", "3500", "99.50"]);
    expect(hoursValue("9:00 AM to 6:00 PM")).toBe("9-18");
    const key = [
      { kind: "price" as const, text: "$1,495/day", jsOnly: true },
      { kind: "price" as const, text: "$1,495 per day", jsOnly: false }, // same value shown without scripts elsewhere
      { kind: "price" as const, text: "$1,995/day", jsOnly: true },
      { kind: "phone" as const, text: "+1 (305) 555-0100", jsOnly: false },
      { kind: "hours" as const, text: "9am - 6pm", jsOnly: false },
    ];
    const sc = scoreExtraction(key, [{ kind: "item", text: "Huracan from 1495 dollars a day" }, { kind: "phone", text: "305.555.0100" }, { kind: "item", text: "Rolls-Royce Cullinan" }, { kind: "item", text: "Bugatti Chiron" }], "Rolls-Royce Cullinan from $1,995/day");
    expect(sc).toMatchObject({ got: 2, of: 4, missedJsOnly: 1, itemsNamed: 3, itemsOnPage: 1 });
    expect(sc.missed.map((f) => f.text)).toEqual(["$1,995/day", "9am - 6pm"]);
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
    expect(reply).toEqual({ couldNotOpen: null, title: "FAQ's | MVP Miami", passages: ["The renter must provide proof of an active insurance policy", "Deliveries are free within Miami-Dade."], facts: [] });
    expect(verifiedPassages(reply.passages, [page])).toEqual([true, true]);
    // ChatGPT appends citation links after the quote; they're not part of the passage.
    const cited = parseReadReply('TITLE: FAQ ([mvpmiami.com](https://www.mvpmiami.com/faq/))\nPASSAGE 1: "The renter must provide proof of an active insurance policy." ([mvpmiami.com](https://www.mvpmiami.com/faq/))\nFACT: phone | 786.877.4317 ([mvpmiami.com](https://www.mvpmiami.com/faq/))');
    expect(cited).toMatchObject({ title: "FAQ", passages: ["The renter must provide proof of an active insurance policy."], facts: [{ kind: "phone", text: "786.877.4317" }] });
    expect(verifiedPassages(cited.passages, [page])).toEqual([true]);
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

function fakeEngine(engine: EngineIndex, mode: "good" | "hallucinate" | "blocked", factLines = ""): AnswerEngine {
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
      const text = mode === "good" ? `TITLE: FAQ\nPASSAGE 1: "The renter must provide proof of an active insurance policy"\nPASSAGE 2: "Deliveries are free within Miami-Dade county."\n${factLines}` : 'TITLE: FAQ\nPASSAGE 1: "MVP offers free champagne on every rental"\nPASSAGE 2: "Open 24 hours a day."';
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

    // Our JavaScript check: the same text with scripts on, so the reading results stand as tested.
    const browser = (extra: string): PageRenderer => ({
      async render(url) {
        return { requestedUrl: url, finalUrl: url, status: 200, html: `<html><body><main><p>${SNAP_TEXT}</p>${extra}</main></body></html>`, truncated: false, error: null, durationMs: 900, userAgent: "HeadlessChrome AIBizScannerBot", requests: { fetched: 3, refused: 0, skipped: 2 } };
      },
    });
    const same = (await run("ws_render", [snap], { browser: browser("") }, store)).input;
    expect((same.output as unknown as JsCheck).pages[0]).toMatchObject({ verdict: "same", raw: { snapshotId: "ps-faq", fallback: false } });
    expect(store.snapshots.filter((x) => x.fetchMode === "rendered")).toHaveLength(1);

    const fr = await run("ws_findread", [snap, same, ...outs], providers, store);
    const f = fr.input.output as unknown as FindRead;
    expect(f.pages[0]!.results.map((r) => r.label)).toEqual(["Found & read", "Not found or read; reason not confirmed", "Not found in search; reading unconfirmed"]);
    expect(f.foundAndRead).toEqual([1, 0, 0]);
    expect(f.selectedPageCount).toBe(1);

    expect(f.pages[0]!.results[0]).toMatchObject({ extraction: { got: 0, of: 0 }, note: "The page shows no prices, phone numbers or hours to check." });

    // Prices that appear only after scripts run, and ChatGPT didn't list them: partly read, explained by our check.
    const priced = (await run("ws_render", [snap], { browser: browser("<ul><li>Lamborghini Huracan from $1,495 per day</li><li>Rolls-Royce Cullinan from $1,995 per day</li></ul>") }, store)).input;
    const pc = (priced.output as unknown as JsCheck).pages[0]!;
    expect(pc.verdict).toBe("key_facts_need_js");
    expect(pc.keyFactsOnlyRendered.map((k) => k.text)).toEqual(["$1,495 per day", "$1,995 per day"]);
    expect(pc.answerKey).toMatchObject({ source: "browser", facts: [{ kind: "price", text: "$1,495 per day", jsOnly: true }, { kind: "price", text: "$1,995 per day", jsOnly: true }] });
    const f2 = (await run("ws_findread", [snap, priced, ...outs], providers, store)).input.output as unknown as FindRead;
    expect(f2.pages[0]!.results[0]).toMatchObject({ read: "partial", toolRead: "readable", label: "Found; partly read", extraction: { got: 0, of: 2, missedJsOnly: 2, answerKey: "browser" } });
    expect(f2.pages[0]!.results[0]!.note).toBe("Got 0 of 2 key facts (prices, phone numbers, hours). Missed e.g. $1,495 per day, $1,995 per day. 2 of the missed facts load only with JavaScript (our check), which this AI's reader didn't get.");
    expect(f2.pages[0]!.js).toEqual({ verdict: "key_facts_need_js", label: "Key facts load with JavaScript" });
    expect(f2.foundAndRead).toEqual([0, 0, 0]);
    expect(f2.keyFacts).toEqual([{ got: 0, of: 2, pages: 1 }, null, null]);

    // An AI whose reader did get them (e.g. one that runs scripts) keeps "read".
    const lister: Record<EngineIndex, AnswerEngine | null> = { ...engines, 0: fakeEngine(0, "good", "FACT: price | Huracan $1,495 per day\nFACT: price | Cullinan $1,995 per day\nFACT: item | Rolls-Royce Cullinan") };
    const read2 = (await run("ws_read_chatgpt", [set, snap], { answers: (e) => lister[e] }, store)).input;
    const f3 = (await run("ws_findread", [snap, priced, ...outs.slice(0, 3), read2, ...outs.slice(4)], providers, store)).input.output as unknown as FindRead;
    expect(f3.pages[0]!.results[0]).toMatchObject({ read: "readable", label: "Found & read", extraction: { got: 2, of: 2, itemsNamed: 1, itemsOnPage: 1 } });
    expect(f3.foundAndRead).toEqual([1, 0, 0]);
  });

  it("checks passages against our earlier good copy when this run's fetch was refused, and says so", async () => {
    const store = new MemoryStore(5, 0, []);
    // An earlier, successful snapshot of the page (an older run), and this run's refused one (HTTP 403, no text).
    store.snapshots.push({ id: "ps-old", reportId: "r1", stageRunId: "old", url: "https://www.mvpmiami.com/faq/", finalUrl: "https://www.mvpmiami.com/faq/", fetchMode: "raw", userAgent: "t", httpStatus: 200, contentHash: null, textHash: null, html: "<html/>", text: SNAP_TEXT, error: null, fetchedAt: "2026-11-17T00:00:02Z" });
    store.snapshots.push({ id: "ps-new", reportId: "r1", stageRunId: "new", url: "https://www.mvpmiami.com/faq/", finalUrl: "https://www.mvpmiami.com/faq/", fetchMode: "raw", userAgent: "t", httpStatus: 403, contentHash: null, textHash: null, html: null, text: null, error: "HTTP 403", fetchedAt: "2026-11-17T00:21:01Z" });
    const i = (runId: string, stage: string, output: unknown): StageInput => ({ runId, stage, output: output as JsonValue, outputHash: null });
    const page = { url: "https://www.mvpmiami.com/faq/", kind: "faq", reason: "FAQ page", snapshotId: "ps-new", finalUrl: "https://www.mvpmiami.com/faq/", status: 403, error: "HTTP 403", truncated: false, title: null, description: null, canonical: null, metaRobots: null, headings: [], wordCount: 0, textExcerpt: "", jsonLdTypes: [], jsonLdErrors: 0, microdataTypes: [], permissions: {} };
    const snap = i("snap", "ws_snapshot", { robots: { url: "https://www.mvpmiami.com/robots.txt", status: 200, registryVersion: "x" }, pages: [page] });
    const set = i("set", "ws_page_set", { pageSet: { id: "00000000-0000-4000-8000-000000000009", version: 2, approvedAt: "x" }, website: "https://www.mvpmiami.com/", business: BIZ, pages: [{ url: page.url, kind: "faq", reason: "FAQ page" }] });
    // An engine whose tool opens the page but returns no content (like OpenAI and Gemini): only our copy can confirm it.
    const engine = fakeEngine(0, "good");
    const noContent: AnswerEngine = { ...engine, async readPage(r) { const res = await engine.readPage!(r, new AbortController().signal); return { ...res, attempts: res.attempts.map((a) => ({ ...a, content: null })) }; } };
    const r = await run("ws_read_chatgpt", [set, snap], { answers: (e) => (e === 0 ? noContent : null) }, store);
    const out = (r.input.output as { pages: { status: string; reference: { snapshotId: string; fetchedAt: string; fallback: boolean } | null }[] }).pages[0]!;
    expect(out.status).toBe("readable");
    expect(out.reference).toEqual({ snapshotId: "ps-old", fetchedAt: "2026-11-17T00:00:02Z", fallback: true });
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
