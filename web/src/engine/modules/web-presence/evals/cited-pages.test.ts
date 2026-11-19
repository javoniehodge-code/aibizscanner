// Stage 8: the outside pages AI cited. Ranking, finding business names on a page, and the stage with a fake web and
// browser (robots.txt followed, refused pages left unchecked, thin pages read in our browser), into Citation coverage.
import { describe, expect, it } from "vitest";
import { reportDocument } from "@/report/schema";
import { FIXTURES } from "@/report/generated/fixtures";
import { MemoryStore } from "../../../engine.test-support";
import { executeRun, type PageRenderer, type Providers, type WebFetcher } from "../../../execute";
import { registry } from "../../../index";
import type { ClaimedRun, FetchedResource, JsonValue, RenderedPage, StageInput } from "../../../types";
import { namesOnPage, rankCitedPages, type SectionPages } from "../logic/pages";
import type { CitedPages } from "../schemas";

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
  });
});

// The fixture report's cited outside pages: angi (thin plain copy), reddit (refuses us), thumbtack, brooklynmag,
// two yelp pages (robots.txt disallows our checker), timeout, two Google Maps pages (browser fails), dot.ny.gov.
const FIX = FIXTURES.brownstone as Record<string, unknown> & { promptAnalysis: unknown; evidence: Record<string, unknown>; engines: unknown[]; business: { v: unknown } };
const ASSEMBLED = { section: FIX.promptAnalysis, evidence: { "prompt-set": { source: "Approved prompt set v1", ref: "stage_run set", capturedOn: "2026-11-13" } }, engines: strip(FIX.engines), business: FIX.business.v };
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
  "https://google.com/maps/place/red-hook-moving-co": html("Red Hook Moving Co. - Google Maps", words(40)),
  "https://google.com/maps/place/brownstone-movers": html("Brownstone Moving - Google Maps", words(40)),
  "https://dot.ny.gov/household-goods-movers": html("Registered movers", `Registered: Brownstone Movers, Red Hook Moving Co. ${words(200)}`),
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
  const claimed: ClaimedRun = { id: `${stage}-${++seq}`, reportId: "r1", stage, version: 1, attempt: 1, maxAttempts: def.maxAttempts, timeoutMs: def.timeoutMs, params: {}, inputRunIds: inputs.map((i) => i.runId), instructions: [] };
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
    expect(out.outsidePages).toBe(10);
    const row = (key: string) => out.pages.find((p) => p.key === key)!;

    expect(row("rv2")).toMatchObject({ state: "unchecked", source: null, names: [] });
    expect(row("rv2").reason).toMatch(/robots\.txt asks checkers like ours not to fetch/);
    expect(fetched.filter((u) => u.startsWith("https://yelp.com/"))).toEqual(["https://yelp.com/robots.txt"]); // the pages themselves aren't fetched
    expect(row("cm1")).toMatchObject({ state: "unchecked", names: [] });
    expect(row("cm1").reason).toBe("We couldn't read this page: our plain fetch failed (HTTP 403); our browser: HTTP 403.");

    expect(row("dr2")).toMatchObject({ state: "checked", source: { mode: "browser" } });
    expect(row("dr2").names.map((n) => n.business)).toEqual(["RH", "BX"]);
    expect(row("ed1").names.map((n) => n.business)).toEqual(["BM"]);
    expect(row("mp1")).toMatchObject({ state: "checked", source: { mode: "plain", words: 40 } }); // browser failed; the plain copy is enough
    expect(row("mp1").names.map((n) => n.business)).toEqual(["BM"]); // via the alias in the page title
    expect(rendered.sort()).toEqual(["https://angi.com/companylist/brooklyn/movers", "https://google.com/maps/place/brownstone-movers", "https://google.com/maps/place/red-hook-moving-co", "https://reddit.com/r/Brooklyn/comments/movers_2021"]);
    expect(store.snapshots.filter((s) => s.fetchMode === "rendered")).toHaveLength(4);

    const sec = await run(store, "wp_section", [wp.input], {});
    expect(sec.outcome.outcome).toBe("done");
    const cov = (sec.input.output as { citationCoverage: { sites: { v: { name: string; pageKeys: string[]; presentBusinesses: string[] } }[]; businesses: { v: string[] }; scope: { v: string } } }).citationCoverage;
    expect(cov.sites.map((s) => [s.v.name, s.v.pageKeys, s.v.presentBusinesses])).toEqual([
      ["angi.com", ["dr2"], ["RH", "BX"]],
      ["thumbtack.com", ["dr1"], ["RH", "TB"]],
      ["brooklynmag.com", ["ed1"], ["BM"]],
      ["timeout.com", ["ed2"], ["GM"]],
      ["google.com", ["mp2", "mp1"], ["RH", "BM"]],
      ["dot.ny.gov", ["of1"], ["BM", "RH"]],
    ]);
    expect(cov.businesses.v).toEqual(["BM", "RH", "BX", "GM", "TB"]);
    expect(cov.scope.v).toBe(
      "We read the 7 outside pages AI cited most (we check up to 20 per report; 10 outside pages were cited in all). A check means the business's name is on a page we read. A blank means it isn't on that page, not that the business is missing from the whole site. 3 more pages couldn't be read and aren't shown: 2 ask checkers like ours not to fetch them (robots.txt), 1 refused us or couldn't be read. Columns show you and the other businesses found on the most sites.",
    );

    const doc = await run(store, "report_assemble", [asm, sec.input], {});
    expect(doc.outcome.outcome).toBe("done");
    const parsed = reportDocument.safeParse(doc.input.output);
    expect(parsed.success, JSON.stringify(parsed.error?.issues.slice(0, 3))).toBe(true);
    expect(parsed.data!.citationCoverage!.sites).toHaveLength(6);
    expect(parsed.data!.evidence["cited-pages"]).toMatchObject({ capturedOn: "2026-11-19" });
    expect(parsed.data!.copy.reportDetails.v).toContain("Produced so far: AI Recommendations and Citation coverage");
  });
});
