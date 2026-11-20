// Stage 8: the outside pages AI cited. Ranking, finding business names on a page, and the stage with a fake web and
// browser (robots.txt followed, refused pages left unchecked, thin pages read in our browser), into Citation coverage.
import { describe, expect, it } from "vitest";
import { coverageMaps, reportDocument } from "@/report/schema";
import { FIXTURES } from "@/report/generated/fixtures";
import { MemoryStore } from "../../../engine.test-support";
import { executeRun, type PageRenderer, type Providers, type WebFetcher } from "../../../execute";
import { registry } from "../../../index";
import type { ClaimedRun, FetchedResource, JsonValue, RenderedPage, StageInput } from "../../../types";
import { PAGE_CAP, namesOnPage, rankCitedPages, type SectionPages } from "../logic/pages";
import type { AssessedPages, CitedPages } from "../schemas";
import { FakeLlmClient } from "../../../testing/fake-llm";
import { instructionRef } from "../../../llm";

const strip = (x: unknown): unknown =>
  Array.isArray(x) ? x.map(strip) : x && typeof x === "object" ? ("v" in x && "p" in x && Object.keys(x).length === 2 ? strip((x as { v: unknown }).v) : Object.fromEntries(Object.entries(x).map(([k, v]) => [k, strip(v)]))) : x;

describe("ranking the cited outside pages", () => {
  it("counts each page once per prompt, leaves out company websites, and breaks ties by answers then key", () => {
    const page = (key: string, category: string) => ({ v: { key, url: `https://x.com/${key}`, category } });
    const ans = (citations: string[]) => ({ v: { status: "ok", citations } });
    const section: SectionPages = {
      pages: [page("yw", "your"), page("oc1", "other"), page("dr1", "dir"), page("rv1", "review"), page("ed1", "ed"), page("ed2", "ed")],
      questions: [
        { question: { v: { id: "P1" } }, answers: [ans(["dr1", "yw", "oc1"]), ans(["dr1", "dr1"]), ans(["rv1"])] },
        { question: { v: { id: "P2" } }, answers: [ans(["rv1", "ed2"]), { v: { status: "unavailable" } }, ans(["ed1"])] },
      ],
    };
    expect(rankCitedPages(section).map((p) => [p.key, p.prompts, p.answers, p.engines])).toEqual([
      ["rv1", 2, 2, [0, 2]],
      ["dr1", 1, 2, [0, 1]],
      ["ed1", 1, 1, [2]],
      ["ed2", 1, 1, [0]],
    ]);
  });
});

describe("finding business names on a page", () => {
  const BIZ = [
    { key: "MM", name: "MVP Miami", aliases: ["MVP Exotics"] },
    { key: "BX", name: "Bushwick Box & Truck" },
    { key: "EN", name: "Enterprise" },
    { key: "JO", name: "Joe's Cars LLC" },
    { key: "TU", name: "Turo" },
  ];
  it("matches whole names in any case, & as and, 's, aliases, and one-word names only as written", () => {
    const found = namesOnPage(
      { title: "Best exotic rentals", text: "We loved mvp  miami. Bushwick Box and Truck moved us. An enterprise-grade fleet. Joes Cars was fine. MVP Exotics delivers. Turo hosts too. MVP Miamians unite." },
      BIZ,
    );
    expect(found.map((f) => f.business)).toEqual(["MM", "BX", "JO", "TU"]);
    expect(found[0]!.excerpt).toContain("mvp  miami".replace("  ", " "));
    expect(namesOnPage({ title: "Enterprise Rent-A-Car Miami", text: "" }, BIZ).map((f) => f.business)).toEqual(["EN"]);
    expect(namesOnPage({ title: null, text: "MVP Miamians and turo-style hosts" }, BIZ)).toEqual([]);
    // Page elements joined together in our copy: "MVP Miami" runs straight into "103 vehicles".
    expect(namesOnPage({ title: null, text: "Other rentals: LUXX Miami94 vehicles MVP Miami103 vehicles" }, BIZ).map((f) => f.business)).toEqual(["MM"]);
  });
});

// The fixture report's cited outside pages: angi (thin plain copy), reddit (refuses us), thumbtack, brooklynmag,
// two yelp pages (robots.txt disallows our checker), timeout, two Google Maps pages (browser fails), dot.ny.gov.
const FIX = FIXTURES.brownstone as Record<string, unknown> & { promptAnalysis: unknown; evidence: Record<string, unknown>; engines: unknown[]; business: { v: unknown } };
const PA = structuredClone(FIX.promptAnalysis) as { pages: unknown[]; questions: { answers: { v: { status: string; citations: string[] } }[] }[] };
PA.pages.push({ v: { key: "ed3", url: "timeout.com/newyork/movers-2", category: "ed" }, p: { kind: "sample" } }, { v: { key: "ed4", url: "timeout.com/newyork/movers-3", category: "ed" }, p: { kind: "sample" } });
PA.questions[0]!.answers.find((a) => a.v.status === "ok")!.v.citations.push("ed3", "ed4");
const ASSEMBLED = { section: PA, evidence: { "prompt-set": { source: "Approved prompt set v1", ref: "stage_run set", capturedOn: "2026-11-13" } }, engines: strip(FIX.engines), business: FIX.business.v };
const SET = {
  promptSet: { id: "00000000-0000-4000-8000-000000000001", version: 1, approvedAt: "2026-11-13T10:00:00Z" },
  target: { name: "Brownstone Movers", aliases: ["Brownstone Moving"], domains: ["brownstonemovers.com"], location: "Brooklyn, NY", category: "Movers" },
  location: { city: "Brooklyn", region: "New York", country: "US", timezone: "America/New_York" },
  groups: [{ name: "Baseline", description: "General" }],
  prompts: [{ id: "P1", group: 0, demand: "Observed demand", text: "Best movers in Brooklyn" }],
};
const words = (n: number) => Array.from({ length: n }, (_, i) => `word${i}`).join(" ");
const html = (title: string, body: string) => `<html><head><title>${title}</title></head><body><main><p>${body}</p></main></body></html>`;
const PAGES: Record<string, string> = {
  "https://angi.com/companylist/brooklyn/movers": html("Angi", "Loading listings"),
  "https://thumbtack.com/ny/brooklyn/movers": html("Thumbtack", `Top movers: Red Hook Moving Co. and Two Bridges Movers. ${words(200)}`),
  "https://brooklynmag.com/best-movers-2026": html("Best movers", `Brownstone Movers is our pick for walk-ups. ${words(300)}`),
  "https://timeout.com/newyork/moving-guide": html("Moving guide", `Try Gowanus Movers. ${words(300)}`),
  "https://timeout.com/newyork/movers-2": html("Please accept cookies", words(60)),
  "https://timeout.com/newyork/movers-3": html("Please accept cookies", words(60)),
  "https://google.com/maps/place/red-hook-moving-co": html("Red Hook Moving Co. - Google Maps", `Red Hook ${words(40)}`),
  "https://google.com/maps/place/brownstone-movers": html("Brownstone Moving - Google Maps", words(40)),
  "https://dot.ny.gov/household-goods-movers": `<html><head><title>Registered movers</title></head><body><main><p>${words(200)}</p></main><aside>Registered: Brownstone Movers, Red Hook Moving Co.</aside></body></html>`,
};
const ok = (url: string, body: string): FetchedResource => ({ requestedUrl: url, finalUrl: url, status: 200, contentType: "text/html", body, truncated: false, redirects: [], error: null, durationMs: 5, userAgent: "test" });
const no = (url: string, status: number): FetchedResource => ({ requestedUrl: url, finalUrl: url, status, contentType: null, body: null, truncated: false, redirects: [], error: `HTTP ${status}`, durationMs: 5, userAgent: "test" });
const fetched: string[] = [];
const web: WebFetcher = {
  async fetch(url) {
    fetched.push(url);
    if (url === "https://yelp.com/robots.txt") return ok(url, "User-agent: Googlebot\nAllow: /\n\nUser-agent: *\nDisallow: /\n");
    if (url.endsWith("/robots.txt")) return no(url, 404);
    if (url.startsWith("https://reddit.com/")) return no(url, 403);
    return PAGES[url] ? ok(url, PAGES[url]) : no(url, 404);
  },
};
const rendered: string[] = [];
const browser: PageRenderer = {
  async render(url): Promise<RenderedPage> {
    rendered.push(url);
    const base = { requestedUrl: url, finalUrl: url, truncated: false, durationMs: 10, userAgent: "browser", requests: { fetched: 1, refused: 0, skipped: 0, failed: 0 } };
    if (url.startsWith("https://angi.com/")) return { ...base, status: 200, html: html("Angi", `Brooklyn movers: Red Hook Moving Co., Bushwick Box & Truck. ${words(400)}`), error: null };
    if (url.startsWith("https://reddit.com/")) return { ...base, status: 403, html: null, error: "HTTP 403" };
    return { ...base, status: null, html: null, error: "The browser couldn't load the page" };
  },
};

let seq = 0;
async function run(store: MemoryStore, stage: string, inputs: StageInput[], providers: Providers) {
  const def = registry.get(stage)!;
  store.inputs = inputs;
  store.finished = null;
  const claimed: ClaimedRun = { id: `${stage}-${++seq}`, reportId: "r1", stage, version: 1, attempt: 1, maxAttempts: def.maxAttempts, timeoutMs: def.timeoutMs, params: {}, inputRunIds: inputs.map((i) => i.runId), instructions: await Promise.all((def.instructions ?? []).map(instructionRef)) };
  const outcome = await executeRun(store, registry, claimed, undefined, providers);
  return { outcome, input: { runId: claimed.id, stage, output: (store.finished as { output: JsonValue } | null)?.output ?? null, outputHash: null, finishedAt: "2026-11-19T12:00:00Z" } as StageInput };
}

describe("wp_pages and Citation coverage", () => {
  it("reads each cited outside page it may, finds the businesses named, and builds the coverage part", async () => {
    const store = new MemoryStore(5, 0, []);
    const set: StageInput = { runId: "set", stage: "pa_prompt_set", output: SET as unknown as JsonValue, outputHash: null };
    const asm: StageInput = { runId: "asm", stage: "pa_assemble", output: ASSEMBLED as unknown as JsonValue, outputHash: null };
    const wp = await run(store, "wp_pages", [set, asm], { web, browser });
    expect(wp.outcome.outcome).toBe("done");
    const out = wp.input.output as unknown as CitedPages;
    expect(out.outsidePages).toBe(12);
    const row = (key: string) => out.pages.find((p) => p.key === key)!;

    expect(row("rv2")).toMatchObject({ state: "unchecked", source: null, names: [] });
    expect(row("rv2").reason).toMatch(/robots\.txt asks checkers like ours not to fetch/);
    expect(fetched.filter((u) => u.startsWith("https://yelp.com/"))).toEqual(["https://yelp.com/robots.txt"]); // the pages themselves aren't fetched
    expect(row("cm1")).toMatchObject({ state: "unchecked", names: [] });
    expect(row("cm1").reason).toBe("We couldn't read this page: our plain fetch failed (HTTP 403); our browser: HTTP 403.");

    expect(row("dr2")).toMatchObject({ state: "checked", source: { mode: "browser" } });
    expect(row("dr2").names.map((n) => n.business)).toEqual(["RH", "BX"]);
    expect(row("ed1").names.map((n) => n.business)).toEqual(["BM"]);
    expect(row("ed1").excerpt).toMatch(/^Brownstone Movers is our pick for walk-ups\. word0 word1/);
    // Two different timeout.com pages gave the same cookie text: a shared shell, not the pages.
    expect(row("ed3")).toMatchObject({ state: "unchecked", names: [] });
    expect(row("ed3").reason).toBe("We couldn't read this page: 2 different pages on timeout.com gave us the same 60 words, so we got a page shared across the site (often a consent, block or loading page), not this one.");
    expect(row("ed2").state).toBe("checked");
    // Names outside <main> count: we read the whole page body.
    expect(row("of1").names.map((n) => n.business)).toEqual(["BM", "RH"]);
    expect(row("mp1")).toMatchObject({ state: "checked", source: { mode: "plain", words: 40 } }); // browser failed; the plain copy is enough
    expect(row("mp1").names.map((n) => n.business)).toEqual(["BM"]); // via the alias in the page title
    expect(rendered.sort()).toEqual(["https://angi.com/companylist/brooklyn/movers", "https://google.com/maps/place/brownstone-movers", "https://google.com/maps/place/red-hook-moving-co", "https://reddit.com/r/Brooklyn/comments/movers_2021", "https://timeout.com/newyork/movers-2", "https://timeout.com/newyork/movers-3"]);
    expect(store.snapshots.filter((s) => s.fetchMode === "rendered")).toHaveLength(6);

    const sec = await run(store, "wp_section", [wp.input, asm], {});
    expect(sec.outcome.outcome).toBe("done");
    const maps = (sec.input.output as { citationCoverage: { line?: unknown; sites: { v: { name: string; pageKeys: string[]; presentBusinesses: string[] } }[]; businesses: { v: string[] }; scope: { v: string } }[] }).citationCoverage;
    expect(maps).toHaveLength(1); // no service lines saved: one map for every question
    const cov = maps[0]!;
    expect(cov.line).toBeUndefined();
    expect(cov.sites.map((s) => [s.v.name, s.v.pageKeys, s.v.presentBusinesses])).toEqual([
      ["angi.com", ["dr2"], ["RH", "BX"]],
      ["thumbtack.com", ["dr1"], ["RH", "TB"]],
      ["brooklynmag.com", ["ed1"], ["BM"]],
      ["timeout.com", ["ed2"], ["GM"]],
      ["google.com", ["mp2", "mp1"], ["BM", "RH"]],
      ["dot.ny.gov", ["of1"], ["BM", "RH"]],
    ]);
    // You, then the businesses named in the most usable answers (ties by name), whether or not a site names them.
    expect(cov.businesses.v).toEqual(["BM", "RH", "GM", "TB", "AA", "FV", "PS", "BX", "GS", "HS"]);
    expect(cov.scope.v).toBe(
      "We read 7 outside pages that AI cited, the most-cited first (up to 20 per report; sites that refuse our checker are passed over and the next pages read instead). Columns show you and the 9 businesses AI named most in these answers (the second table continues the first). A check means the business's name is on a page we read. A blank means it isn't on that page, not that the business is missing from the whole site. 5 more pages couldn't be read and aren't shown: 2 ask checkers like ours not to fetch them (robots.txt), 1 refused us or couldn't be read, 2 showed us only a page shared across the site.",
    );

    const doc = await run(store, "report_assemble", [asm, sec.input], {});
    expect(doc.outcome.outcome).toBe("done");
    const parsed = reportDocument.safeParse(doc.input.output);
    expect(parsed.success, JSON.stringify(parsed.error?.issues.slice(0, 3))).toBe(true);
    expect(coverageMaps(parsed.data!.citationCoverage)[0]!.sites).toHaveLength(cov.sites.length);
    expect(parsed.data!.evidence["cited-pages"]).toMatchObject({ capturedOn: "2026-11-19" });
    expect(parsed.data!.copy.reportDetails.v).toContain("Produced so far: AI Recommendations and Citation coverage");
    expect(parsed.data!.credible).toBeNull();

    // wp_assess: one reading per page we read; plain code checks each against the page and the name check.
    const cols = (over: Record<string, { status: string; quote?: string; says?: string }> = {}) =>
      ["details", "services", "fit", "reviews", "recommendations", "locations"].map((column) => ({ column, status: "N", says: "Not on the page.", quote: null, issue: null, action: null, ...(over[column] ?? {}) }));
    const reading = (o: Record<string, unknown>) => JSON.stringify({ presence: "none", detail: "A page about movers.", supports: "No reason to choose you.", reasons: [], concerns: [], recommendedInstead: [], columns: cols(), review: null, ...o });
    const READ: Record<string, string> = {
      "https://brooklynmag.com/best-movers-2026": reading({
        presence: "rec",
        detail: "Brooklyn Magazine names Brownstone Movers its pick for walk-up moves.",
        supports: "Best for walk-up moves.",
        reasons: [{ reason: "Its pick for walk-up moves", quote: "Brownstone Movers is our pick for walk-ups" }],
        columns: cols({ recommendations: { status: "P", quote: "Brownstone Movers is our pick for walk-ups", says: "Recommended for walk-ups." }, fit: { status: "P", quote: "our pick for walk-ups", says: "Walk-up moves." }, details: { status: "A" } }),
      }),
      // Recommends with a reason that isn't on the page, and a details quote too short to check.
      "https://dot.ny.gov/household-goods-movers": reading({ presence: "rec", reasons: [{ reason: "Licensed", quote: "Brownstone Movers is fully licensed and insured" }], columns: cols({ details: { status: "P", quote: "Registered: Brownstone Movers" } }) }),
      // Says none, but our name check found the business (via its alias): listed. Its rating isn't on the page.
      "https://google.com/maps/place/brownstone-movers": reading({ review: { rating: "4.8", scale: 5, count: "120", recent: null, themes: "Careful crews", quote: "4.8 stars from 120 reviews" } }),
      // Says rec, but the business isn't on the page.
      "https://thumbtack.com/ny/brooklyn/movers": reading({ presence: "rec", reasons: [{ reason: "x", quote: "Top movers: Red Hook Moving Co." }], recommendedInstead: ["Red Hook Moving Co.", "Two Bridges Movers"] }),
    };
    const llm = new FakeLlmClient((r) => READ[(JSON.parse(r.user.slice(r.user.indexOf("{"))) as { page: { url: string } }).page.url] ?? reading({}));
    const asd = await run(store, "wp_assess", [set, wp.input], { llm });
    expect(asd.outcome.outcome).toBe("done");
    expect(llm.requests).toHaveLength(7); // the 7 pages we read
    const got = (asd.input.output as unknown as AssessedPages).pages;
    const rd = (key: string) => got.find((p) => p.key === key)!.reading!;
    expect(rd("ed1")).toMatchObject({ presence: "rec", columns: { recommendations: { status: "P" }, fit: { status: "P" }, details: { status: "A" } } });
    expect(rd("of1")).toMatchObject({ presence: "list", columns: { details: { status: "U" } } });
    expect(rd("of1").overruled).toEqual(["1 reason(s) dropped: quote not on the page", "presence rec -> list: no reason quoted from the page", "details: P -> U, quote not on the page"]);
    expect(rd("mp1")).toMatchObject({ presence: "list", review: null });
    expect(rd("dr1")).toMatchObject({ presence: "none", reasons: [] });

    const sec2 = await run(store, "wp_section", [wp.input, asm, asd.input], {});
    const doc2 = await run(store, "report_assemble", [asm, sec2.input], {});
    const p2 = reportDocument.safeParse(doc2.input.output);
    expect(p2.success, JSON.stringify(p2.error?.issues.slice(0, 3))).toBe(true);
    const cr = p2.data!.credible!;
    expect(cr.standout.v).toBe('"Best movers" (brooklynmag.com) recommends you: Its pick for walk-up moves. The page AI cites most that we could read, "Angi" (angi.com), features Red Hook Moving Co. and Bushwick Box & Truck instead.');
    expect(cr.categories.map((c) => c.v.name)).toContain("Editorial & publications");
    expect(cr.pages.map((p) => [p.v.url, p.v.presence])).toEqual([
      ["angi.com/companylist/brooklyn/movers", "none"],
      ["reddit.com/r/Brooklyn/comments/movers_2021", "unchecked"],
      ["thumbtack.com/ny/brooklyn/movers", "none"],
      ["brooklynmag.com/best-movers-2026", "rec"],
      ["yelp.com/biz/red-hook-moving-co-brooklyn", "unchecked"],
      ["yelp.com/biz/brownstone-movers-brooklyn", "unchecked"],
      ["timeout.com/newyork/moving-guide", "none"],
      ["google.com/maps/place/red-hook-moving-co", "none"],
      ["timeout.com/newyork/movers-2", "unchecked"],
      ["timeout.com/newyork/movers-3", "unchecked"],
      ["google.com/maps/place/brownstone-movers", "list"],
      ["dot.ny.gov/household-goods-movers", "list"],
    ]);
    expect(cr.web.sites.map((s) => [s.v.name, s.v.present, s.v.quality])).toContainEqual(["brooklynmag.com", true, "good"]);
    expect(cr.web.sites.map((s) => [s.v.name, s.v.present, s.v.quality])).toContainEqual(["angi.com", false, null]);
    expect(cr.fixes.map((f) => f.v.title)).toEqual(["Get onto thumbtack.com", "Give google.com a reason to recommend you"]); // angi.com names others but recommends no one
    expect(cr.fixes[0]!.v.text).toBe('"Thumbtack" is cited for 2 prompts and features Red Hook Moving Co. and Two Bridges Movers, but not you.');
    expect(cr.reviews).toEqual([]);
    const wpm = p2.data!.webPresence!;
    const site = (n: string) => wpm.find((w) => w.v.name === n)!.v;
    expect(site("brooklynmag.com")).toMatchObject({ marks: ["A", "N", "P", "N", "P", "N"], pagesChecked: 1, pagesFailed: 0 });
    expect(site("brooklynmag.com").details["4"]).toMatchObject({ excerpt: "Brownstone Movers is our pick for walk-ups", url: "brooklynmag.com/best-movers-2026" });
    expect(site("reddit.com")).toMatchObject({ marks: ["U", "U", "U", "U", "U", "U"], pagesChecked: 0, pagesFailed: 1 });
    expect(site("timeout.com")).toMatchObject({ pagesChecked: 1, pagesFailed: 2 });
    expect(p2.data!.copy.reportDetails.v).toContain("Citation coverage and Credible & corroborated");
  });
});

describe("first MVP Miami run (19 Nov 2026)", () => {
  it("whole-body reading separates inline elements, so a business name doesn't run into the next word", async () => {
    const { extractPage } = await import("../../website/logic/extract");
    const html = '<html><body><main><p>LUXX Miami</p></main><div><a href="/x"><span>MVP Miami</span><span>103 vehicles</span></a></div></body></html>';
    expect(extractPage(html, { wholeBody: true }).text).toContain("MVP Miami 103 vehicles");
    expect(extractPage(html).text).toBe("LUXX Miami"); // the website checks keep reading only the main area
  });

  it("suggests getting onto a page only when it recommends others, and lists long name lists plainly", async () => {
    const { buildCredible } = await import("../logic/credible");
    const cols = { status: "N", says: "", quote: null, issue: null, action: null };
    const page = (key: string, names: string[]) => ({ key, url: `https://${key}.com/x`, site: `${key}.com`, category: "dir", title: key, prompts: 1, answers: 1, engines: [0], state: "checked", reason: null,
      source: { mode: "plain", snapshotId: key, status: 200, finalUrl: null, fetchedAt: "x", words: 900 }, excerpt: null, attempts: [], names: names.map((b) => ({ business: b, excerpt: "e" })) });
    const rd = (inst: string[]) => ({ presence: "none", detail: "d", supports: "s", reasons: [], concerns: [], recommendedInstead: inst, review: null, overruled: [], columns: { details: cols, services: cols, fit: cols, reviews: cols, recommendations: cols, locations: cols } });
    const cp = { version: "x", cap: 20, outsidePages: 2, businesses: [{ key: "MM", name: "MVP Miami", target: true }, { key: "GIG", name: "Giggster", target: false }], pages: [page("giggster", ["GIG"]), page("lists", [])] };
    const as = { version: "x", model: "m", fromRun: "r", pages: [{ key: "giggster", cutAt: null, error: null, reading: rd([]) }, { key: "lists", cutAt: null, error: null, reading: rd(["A Cars", "B Cars", "C Cars", "D Cars", "E Cars"]) }] };
    const pa = { pages: [{ v: { key: "giggster", category: "dir" } }, { v: { key: "lists", category: "dir" } }], questions: [{ question: { v: { id: "P1", text: "q" } }, answers: [{ v: { status: "ok", citations: ["giggster", "lists"] } }] }] };
    const cr = buildCredible(cp as never, as as never, pa, "MVP Miami");
    expect(cr.fixes.map((f) => f.v.title)).toEqual(["Get onto lists.com"]);
    expect(cr.fixes[0]!.v.text).toBe('"lists" is cited for 1 prompt and features A Cars, B Cars, C Cars and 2 others, but not you.');
  });

  it("gives one fix per site, with all its pages that feature others", async () => {
    const { buildCredible } = await import("../logic/credible");
    const cols = { status: "N", says: "", quote: null, issue: null, action: null };
    const page = (key: string, title: string) => ({ key, url: `https://rmr.com/${key}`, site: "rmr.com", category: "ed", title, prompts: 1, answers: 1, engines: [0], state: "checked", reason: null,
      source: { mode: "plain", snapshotId: key, status: 200, finalUrl: null, fetchedAt: "x", words: 900 }, excerpt: null, attempts: [], names: [] });
    const rd = (inst: string[]) => ({ presence: "none", detail: "d", supports: "s", reasons: [], concerns: [], recommendedInstead: inst, review: null, overruled: [], columns: { details: cols, services: cols, fit: cols, reviews: cols, recommendations: cols, locations: cols } });
    const cp = { version: "x", cap: 20, outsidePages: 2, businesses: [{ key: "MM", name: "MVP Miami", target: true }], pages: [page("a", "Best 2023"), page("b", "Best 2025")] };
    const as = { version: "x", model: "m", fromRun: "r", pages: [{ key: "a", cutAt: null, error: null, reading: rd(["RealCar", "Prestige", "mph club", "Lou La Vie"]) }, { key: "b", cutAt: null, error: null, reading: rd(["Prestige", "mph club", "BluStreet"]) }] };
    const pa = { pages: [{ v: { key: "a", category: "ed" } }, { v: { key: "b", category: "ed" } }], questions: [
      { question: { v: { id: "P1", text: "q1" } }, answers: [{ v: { status: "ok", citations: ["a", "b"] } }, { v: { status: "ok", citations: ["a"] } }] },
      { question: { v: { id: "P2", text: "q2" } }, answers: [{ v: { status: "ok", citations: ["b"] } }] },
    ] };
    const cr = buildCredible(cp as never, as as never, pa, "MVP Miami");
    // Two prompts in all (q1 cites both pages but counts once); names most-featured first.
    expect(cr.fixes.map((f) => [f.v.title, f.v.text])).toEqual([["Get onto rmr.com", '2 of its pages, cited for 2 prompts, feature Prestige, mph club, RealCar and 2 others, but not you: "Best 2023" and "Best 2025".']]);
  });

  it("suggests getting onto listing, review and editorial sites only, and doesn't say on and not on for one site", async () => {
    const { buildCredible } = await import("../logic/credible");
    const pg = (key: string, site: string, category: string, names: string[]) => ({
      key, url: `https://${site}/${key}`, site, category, title: `T ${key}`, prompts: 1, answers: 1, engines: [0], state: "checked",
      reason: null, source: { mode: "plain", snapshotId: key, status: 200, finalUrl: null, fetchedAt: "x", words: 900 }, excerpt: null, attempts: [],
      names: names.map((b) => ({ business: b, excerpt: "e" })),
    });
    const cp = { version: "x", cap: 20, outsidePages: 3, businesses: [{ key: "MM", name: "MVP Miami", target: true }, { key: "EX", name: "Exotic Miami", target: false }, { key: "MC", name: "mph club", target: false }],
      pages: [pg("ed1", "rmr.com", "ed", ["MC"]), pg("ed2", "rmr.com", "ed", ["MM", "MC"]), pg("un1", "exoticmiami.com", "unc", ["EX"])] };
    const cols = { status: "N", says: "", quote: null, issue: null, action: null };
    const rd = (presence: string, inst: string[]) => ({ presence, detail: "d", supports: "s", reasons: presence === "rec" ? [{ reason: "Reliable", quote: "q q q q" }] : [], concerns: [], recommendedInstead: inst, review: null, overruled: [],
      columns: { details: cols, services: cols, fit: cols, reviews: cols, recommendations: cols, locations: cols } });
    const as = { version: "x", model: "m", fromRun: "r", pages: [
      { key: "ed1", cutAt: null, error: null, reading: rd("none", ["mph club"]) },
      { key: "ed2", cutAt: null, error: null, reading: rd("rec", []) },
      { key: "un1", cutAt: null, error: null, reading: rd("none", ["Exotic Miami"]) },
    ] };
    const pa = { pages: [{ v: { key: "ed1", category: "ed" } }, { v: { key: "ed2", category: "ed" } }, { v: { key: "un1", category: "unc" } }],
      questions: [{ question: { v: { id: "P1", text: "Best exotic rentals" } }, answers: [{ v: { status: "ok", citations: ["ed1", "ed2"] } }, { v: { status: "ok", citations: ["ed1"] } }, { v: { status: "ok", citations: ["un1"] } }] }] };
    const cr = buildCredible(cp as never, as as never, pa, "MVP Miami");
    expect(cr.fixes.map((f) => f.v.title)).toEqual(["Get onto more rmr.com pages"]); // not the competitor's own site
    expect(cr.fixes[0]!.v.text).toBe('"T ed1" is cited for 1 prompt and features mph club, but not you.');
    expect(cr.categories.find((c) => c.v.name === "Editorial & publications")!.v.note).toBe("On rmr.com");
    expect(cr.takeaway.v).toContain("You don't appear on any other or unclassified sites we read.");
  });
});

describe("review fixes (PR 45)", () => {
  const page = (key: string, site: string, state: "checked" | "unchecked") => ({
    key, url: `https://${site}/${key}`, site, category: "dir" as const, title: key, prompts: 1, answers: 1, engines: [0], state,
    reason: state === "unchecked" ? "We couldn't read this page: HTTP 403." : null,
    source: state === "checked" ? { mode: "plain" as const, snapshotId: `s-${key}`, status: 200, finalUrl: null, fetchedAt: "2026-11-19T00:00:00Z", words: 500 } : null,
    excerpt: null, attempts: [], names: [],
  });
  const cell = (status: "P" | "L" | "N" | "A" | "U") => ({ status, says: status === "P" ? "Shown." : "", quote: status === "P" ? "the words on the page here" : null, issue: null, action: null });
  const reading = (marks: ("P" | "L" | "N" | "A" | "U")[]) => ({
    presence: "list" as const, detail: "d", supports: "s", reasons: [], concerns: [], recommendedInstead: [], review: null, overruled: [],
    columns: { details: cell(marks[0]!), services: cell(marks[1]!), fit: cell(marks[2]!), reviews: cell(marks[3]!), recommendations: cell(marks[4]!), locations: cell(marks[5]!) },
  });

  it("combines a site's pages without claiming an absence nobody established", async () => {
    const { buildWebPresence } = await import("../logic/credible");
    const cp = { version: "x", cap: 20, outsidePages: 2, businesses: [{ key: "BM", name: "B", target: true }], pages: [page("a", "x.com", "checked"), page("b", "x.com", "checked")] };
    const as = { version: "x", model: "m", fromRun: "r", pages: [
      { key: "a", cutAt: null, error: null, reading: reading(["A", "N", "A", "A", "P", "U"]) },
      { key: "b", cutAt: null, error: null, reading: reading(["U", "U", "A", "N", "N", "N"]) },
    ] };
    // details A+U -> U (not "not found"); services N+U -> U; fit A+A -> A; reviews A+N -> N; P wins; locations U+N -> U.
    expect(buildWebPresence(cp, as)[0]!.v.marks).toEqual(["U", "U", "A", "N", "P", "U"]);
  });

  it("leaves Credible and the map out when no page could be read, and still builds Citation coverage", async () => {
    const store = new MemoryStore(5, 0, []);
    const cp = { version: "x", cap: 20, outsidePages: 2, businesses: [{ key: "BM", name: "Brownstone Movers", target: true }], pages: [page("dr2", "angi.com", "unchecked"), page("rv1", "yelp.com", "checked")] };
    const wpIn: StageInput = { runId: "wp-1", stage: "wp_pages", output: cp as unknown as JsonValue, outputHash: null, finishedAt: "2026-11-19T00:00:00Z" };
    const asIn: StageInput = { runId: "as-1", stage: "wp_assess", output: { version: "x", model: "m", fromRun: "wp-1", pages: [{ key: "rv1", cutAt: null, reading: null, error: "provider exploded" }] } as unknown as JsonValue, outputHash: null };
    const asm: StageInput = { runId: "asm", stage: "pa_assemble", output: ASSEMBLED as unknown as JsonValue, outputHash: null };
    const sec = await run(store, "wp_section", [wpIn, asm, asIn], {});
    expect(sec.outcome.outcome).toBe("done");
    const out = sec.input.output as { citationCoverage: { scope: { v: string } }[]; credible: unknown; webPresence: unknown };
    expect(out.credible).toBeNull();
    expect(out.webPresence).toBeNull();
    expect(out.citationCoverage[0]!.scope.v).toContain("1 more page couldn't be read");
    const doc = await run(store, "report_assemble", [asm, sec.input], {});
    expect(reportDocument.safeParse(doc.input.output).success).toBe(true);
  });
});

describe("wp_pages: refusing sites and directories named like a business", () => {
  it("passes over a site that refused us, fills the 20 with the next pages, and keeps only real marketplaces", async () => {
    // Cited most: 4 reddit.com pages (reddit refuses us), a directory page on Red Hook Moving Co.'s own website (names
    // only them) and one on gowanusmovers.com that lists other movers (a marketplace). Then 25 directory pages.
    const pa = structuredClone(FIX.promptAnalysis) as { pages: unknown[]; questions: { answers: { v: { status: string; citations: string[] } }[] }[] };
    const pg = (key: string, url: string, category: string) => ({ v: { key, url, category }, p: { kind: "sample" } });
    const reddit = Array.from({ length: 4 }, (_, i) => `cm${i + 50}`);
    const lists = Array.from({ length: 25 }, (_, i) => `dr${i + 100}`);
    pa.pages.push(...reddit.map((k) => pg(k, `reddit.com/r/movers/${k}`, "comm")), ...lists.map((k) => pg(k, `list${k}.com/movers`, "dir")), pg("dr90", "redhookmovingco.com/about", "dir"), pg("dr91", "gowanusmovers.com/list", "dir"));
    for (const q of pa.questions) for (const a of q.answers) if (a.v.status === "ok") a.v.citations.push(...reddit, "dr90", "dr91");
    pa.questions[0]!.answers.find((a) => a.v.status === "ok")!.v.citations.push(...lists);
    const assembled = { ...ASSEMBLED, section: pa };
    const page = (body: string) => html("Movers", `${body} ${words(200)}`);
    const site: WebFetcher = {
      async fetch(url) {
        if (url.endsWith("/robots.txt")) return no(url, 404);
        if (url.startsWith("https://reddit.com/")) return no(url, 403);
        if (url === "https://redhookmovingco.com/about") return ok(url, page("Red Hook Moving Co. has moved Brooklyn since 1990."));
        if (url === "https://gowanusmovers.com/list") return ok(url, page("Compare Red Hook Moving Co., Two Bridges Movers and Bushwick Box & Truck."));
        if (/^https:\/\/listdr\d+\.com\//.test(url)) return ok(url, page(`Listing ${url}.`));
        return PAGES[url] ? ok(url, PAGES[url]) : no(url, 404);
      },
    };
    const noBrowser: PageRenderer = { async render(url) { return { requestedUrl: url, finalUrl: url, truncated: false, durationMs: 1, userAgent: "browser", requests: { fetched: 0, refused: 0, skipped: 0, failed: 0 }, status: 403, html: null, error: "HTTP 403" }; } };
    const store = new MemoryStore(5, 0, []);
    const set: StageInput = { runId: "set", stage: "pa_prompt_set", output: SET as unknown as JsonValue, outputHash: null };
    const asm: StageInput = { runId: "asm", stage: "pa_assemble", output: assembled as unknown as JsonValue, outputHash: null };
    const wp = await run(store, "wp_pages", [set, asm], { web: site, browser: noBrowser });
    expect(wp.outcome, JSON.stringify(wp.outcome)).toMatchObject({ outcome: "done" });
    const out = wp.input.output as unknown as CitedPages;
    const state = (k: string) => out.pages.find((p) => p.key === k);
    // reddit refused us: its pages don't take any of the 20 places.
    expect(out.pages.filter((p) => p.state === "checked")).toHaveLength(PAGE_CAP);
    expect(reddit.map((k) => state(k)?.state)).toEqual(["unchecked", "unchecked", "unchecked", "unchecked"]);
    // Red Hook Moving Co.'s own site isn't an outside page; the marketplace naming three movers is.
    expect(state("dr90")).toBeUndefined();
    expect(out.ownSites).toBe(1);
    expect(state("dr91")?.state).toBe("checked");
  });
});
