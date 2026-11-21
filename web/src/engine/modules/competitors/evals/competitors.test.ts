// Competitor comparison (Milestone 5): the two businesses AI recommends most in the main line (or an admin's choice),
// their own pages AI cited plus their home page, their facts and the answers' reasons, built into the slide in plain
// code. Uses the MVP Miami example report with a fake web and a fake model.
import { describe, expect, it } from "vitest";
import { FIXTURES } from "@/report/generated/fixtures";
import { reportDocument } from "@/report/schema";
import { MemoryStore } from "../../../engine.test-support";
import { executeRun, type PageRenderer, type Providers, type WebFetcher } from "../../../execute";
import { registry } from "../../../index";
import { instructionRef } from "../../../llm";
import { FakeLlmClient } from "../../../testing/fake-llm";
import type { ClaimedRun, FetchedResource, JsonValue, StageInput } from "../../../types";
import { competitorSite, mainLine, pickCompetitors, rankBusinesses, type Answers } from "../logic/pick";
import type { CompetitorPages } from "../stages";

const strip = (x: unknown): unknown =>
  Array.isArray(x) ? x.map(strip) : x && typeof x === "object" ? ("v" in x && "p" in x && Object.keys(x).length === 2 ? strip((x as { v: unknown }).v) : Object.fromEntries(Object.entries(x).map(([k, v]) => [k, strip(v)]))) : x;
const FIX = FIXTURES["mvp-miami"] as Record<string, unknown> & { promptAnalysis: Answers & Record<string, unknown>; engines: unknown[]; business: { v: { key: string; name: string; location: string } } };
const PA = FIX.promptAnalysis;

describe("choosing the two competitors", () => {
  it("ranks by answers recommending them, then naming them, then name; the main line is the one with most questions", () => {
    const { ranked, answers } = rankBusinesses(PA, null);
    expect(answers).toBe(35);
    expect(ranked.slice(0, 3).map((r) => [r.name, r.recommended])).toEqual([
      ["Octane Rent", 12],
      ["Prestige Luxury Rentals", 11],
      ...ranked.slice(2, 3).map((r) => [r.name, r.recommended]),
    ]);
    expect(pickCompetitors(ranked, PA.businesses, "MV", null).map((r) => r.key)).toEqual(["OC", "PL"]);
    expect(mainLine([{ name: "Villas", questions: ["P6"] }, { name: "Cars", questions: ["P1", "P2", "P3"] }])!.name).toBe("Cars");
    expect(mainLine(null)).toBeNull();
  });

  it("uses the admin's two names (any case), and refuses a name the answers don't give", () => {
    const { ranked } = rankBusinesses(PA, null);
    expect(pickCompetitors(ranked, PA.businesses, "MV", ["MPH CLUB", "luxx miami"]).map((r) => r.key)).toEqual(["MC", "LX"]);
    expect(() => pickCompetitors(ranked, PA.businesses, "MV", ["Nobody Rentals", "mph club"])).toThrow(/"Nobody Rentals" isn't a business the AI answers named/);
  });

  it("finds a competitor's own site among the cited pages, then adds its home page", () => {
    expect(competitorSite(PA, { key: "OC", name: "Octane Rent" })).toEqual({ site: "octane.rent", urls: ["https://octane.rent/lamborghini-rental-miami", "https://octane.rent/"] });
    expect(competitorSite(PA, { key: "PL", name: "Prestige Luxury Rentals" })).toEqual({ site: "prestigeluxuryrentals.com", urls: ["https://prestigeluxuryrentals.com/"] });
    expect(competitorSite(PA, { key: "SL", name: "Starr Luxury Cars" })).toBeNull();
  });
});

const html = (title: string, body: string) => `<html><head><title>${title}</title></head><body><main><p>${body}</p></main></body></html>`;
const words = (n: number) => Array.from({ length: n }, (_, i) => `word${i}`).join(" ");
const PAGES: Record<string, string> = {
  "https://octane.rent/lamborghini-rental-miami": html("Lamborghini rental", `Lamborghini Urus from $1,095 per day. Renters must be 21 years or older. Call (305) 555-0100. ${words(200)}`),
  "https://octane.rent/": html("Octane Rent", `Exotic car rental in Miami. ${words(200)}`),
  "https://prestigeluxuryrentals.com/": html("Prestige", `Loading`),
};
const ok = (url: string, body: string): FetchedResource => ({ requestedUrl: url, finalUrl: url, status: 200, contentType: "text/html", body, truncated: false, redirects: [], error: null, durationMs: 5, userAgent: "test" });
const no = (url: string, status: number): FetchedResource => ({ requestedUrl: url, finalUrl: url, status, contentType: null, body: null, truncated: false, redirects: [], error: `HTTP ${status}`, durationMs: 5, userAgent: "test" });
const web: WebFetcher = { async fetch(url) { return url.endsWith("/robots.txt") ? no(url, 404) : PAGES[url] ? ok(url, PAGES[url]) : no(url, 404); } };
const browser: PageRenderer = { async render(url) { return { requestedUrl: url, finalUrl: url, truncated: false, durationMs: 1, userAgent: "browser", requests: { fetched: 0, refused: 0, skipped: 0, failed: 0 }, status: 403, html: null, error: "HTTP 403" }; } };

let seq = 0;
async function run(store: MemoryStore, stage: string, inputs: StageInput[], providers: Providers, params: Record<string, JsonValue> = {}) {
  const def = registry.get(stage)!;
  store.inputs = inputs;
  store.finished = null;
  const claimed: ClaimedRun = { id: `${stage}-${++seq}`, reportId: "r1", stage, version: 1, attempt: 1, maxAttempts: def.maxAttempts, timeoutMs: def.timeoutMs, params, inputRunIds: inputs.map((i) => i.runId), instructions: await Promise.all((def.instructions ?? []).map(instructionRef)) };
  const outcome = await executeRun(store, registry, claimed, undefined, providers);
  return { outcome, input: { runId: claimed.id, stage, output: (store.finished as { output: JsonValue } | null)?.output ?? null, outputHash: null, finishedAt: "2026-11-20T12:00:00Z" } as StageInput };
}

describe("cp_pages, cp_assess and cp_section into the report", () => {
  it("reads their pages, keeps only facts and reasons backed by the page or answer, and builds a valid slide", async () => {
    const SET = {
      promptSet: { id: "00000000-0000-4000-8000-000000000001", version: 1, approvedAt: "2026-11-13T10:00:00Z" },
      target: { name: "MVP Miami", aliases: [], domains: ["mvpmiami.com"], location: "Miami, FL", category: "Exotic car rental" },
      location: null,
      groups: [{ name: "Baseline", description: "General" }],
      prompts: (PA.questions as unknown as { question: { v: { id: string; text: string } } }[]).map((q) => ({ id: q.question.v.id, group: 0, demand: "Observed demand", text: q.question.v.text })),
    };
    const assembled = { section: PA, evidence: { ...(FIX.evidence as Record<string, unknown>), "prompt-set": { source: "Approved prompt set v1", ref: "stage_run set", capturedOn: "2026-11-13" } }, engines: strip(FIX.engines), business: FIX.business.v };
    const store = new MemoryStore(5, 0, []);
    const set: StageInput = { runId: "set", stage: "pa_prompt_set", output: SET as unknown as JsonValue, outputHash: null };
    const asm: StageInput = { runId: "asm", stage: "pa_assemble", output: assembled as unknown as JsonValue, outputHash: null };

    const pages = await run(store, "cp_pages", [set, asm], { web, browser });
    expect(pages.outcome, JSON.stringify(pages.outcome)).toMatchObject({ outcome: "done" });
    const cp = pages.input.output as unknown as CompetitorPages;
    expect(cp.competitors.map((c) => [c.name, c.site, c.pages.map((p) => p.state)])).toEqual([
      ["Octane Rent", "octane.rent", ["checked", "checked"]],
      ["Prestige Luxury Rentals", "prestigeluxuryrentals.com", ["unchecked"]],
    ]);

    // The model: values for Octane Rent (one with a quote that isn't on the page), and reasons per business.
    const llm = new FakeLlmClient((r) => {
      const input = JSON.parse(r.user.slice(r.user.indexOf("{"))) as { business: string | { name: string }; answers?: { ref: string; text: string }[] };
      if (typeof input.business === "object")
        return JSON.stringify({
          values: [
            { fact: "prices", ref: "C1", value: "$1,095 per day", amount: 1095, unit: "day", item: "Lamborghini Urus", quote: "Lamborghini Urus from $1,095 per day" },
            { fact: "requirements", ref: "C1", value: "21 years or older", amount: 21, unit: "years", item: null, quote: "Renters must be 21 years or older" },
            { fact: "deposit-payment", ref: "C1", value: "$500", amount: 500, unit: "USD", item: null, quote: "A deposit of $500 is required" },
          ],
        });
      const first = input.answers![0]!;
      const quote = first.text.split(/\s+/).slice(0, 6).join(" ");
      return JSON.stringify({ reasons: [{ title: "Named first", detail: "The answer lists it.", ref: first.ref, quote }], concerns: [{ title: "Invented", detail: "Not in any answer.", ref: first.ref, quote: "this sentence is not in the answer at all" }] });
    });
    const as = await run(store, "cp_assess", [set, asm, pages.input], { llm });
    expect(as.outcome, JSON.stringify(as.outcome)).toMatchObject({ outcome: "done" });
    expect(llm.requests).toHaveLength(4); // Octane's values (Prestige couldn't be read), and reasons for 3 businesses

    const sec = await run(store, "cp_section", [set, pages.input, as.input], {});
    const out = sec.input.output as { competitors: { compared: { v: string[] }; rows: { v: { name: string; cells: { value: string; mark: string | null }[] } }[]; reasons: { v: { title: string }[] }[]; concerns: { v: { title: string }[] }[]; cards: { v: { kind: string; heading: string } }[] } };
    const c = out.competitors;
    expect(c.compared.v).toEqual(["OC", "PL"]);
    expect(c.rows.map((r) => [r.v.name, r.v.cells.map((x) => [x.value, x.mark])])).toEqual([
      ["Prices and what's included", [["Your website isn't checked yet", null], ["Lamborghini Urus: $1,095 per day", null], ["Couldn't read its website", null]]],
      ["Rental requirements", [["Your website isn't checked yet", null], ["21 years or older", null], ["Couldn't read its website", null]]],
    ]); // the $500 deposit was dropped: its quote isn't on the page
    expect(c.reasons.map((r) => r.v.map((x) => x.title))).toEqual([["Named first"], ["Named first"], ["Named first"]]);
    expect(c.concerns[0]!.v[0]!.title).toBe("No concern raised"); // the invented concern was dropped
    expect(c.cards.map((x) => x.v.kind)).toEqual(["YOUR ADVANTAGE", "IMPORTANT DISADVANTAGE", "DO FIRST"]);

    const doc = await run(store, "report_assemble", [asm, sec.input], {});
    expect(doc.outcome, JSON.stringify(doc.outcome)).toMatchObject({ outcome: "done" });
    const parsed = reportDocument.safeParse(doc.input.output);
    expect(parsed.success, JSON.stringify(parsed.error?.issues.slice(0, 3))).toBe(true);
    expect(parsed.data!.competitors!.compared.v).toEqual(["OC", "PL"]);
    expect(parsed.data!.copy.reportDetails.v).toContain("Competitor comparison");
  });
});
