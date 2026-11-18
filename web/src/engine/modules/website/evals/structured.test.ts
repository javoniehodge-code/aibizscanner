// Website: structured data (the facts in the site's code vs what its pages show). Plain code, no model.
import { describe, expect, it } from "vitest";
import { websiteStructuredData } from "@/report/schema";
import { extractPage } from "../logic/extract";
import { buildStructuredData } from "../logic/section";
import { checkStructuredData, codeHours, type CheckedPage } from "../logic/structured";

// MVP Miami's business block (17 Nov 2026), as served in the page's HTML.
const MVP_BLOCK = {
  "@context": "https://schema.org",
  "@type": "AutomotiveBusiness",
  name: "MVP Miami ",
  telephone: "+1-786-877-4317",
  address: { "@type": "PostalAddress", streetAddress: "2500 NW 39TH STREET ", addressLocality: "MIAMI", postalCode: "33142", addressCountry: "US", addressRegion: "FLORIDA" },
  openingHours: ["Mo-Su 09:30-21:30"],
  priceRange: "$$$",
};
const SEO = { "@context": "https://schema.org", "@graph": [{ "@type": "WebSite", name: "MVP Miami Rentals" }, { "@type": "Organization", name: "MVP Miami Rentals" }, { "@type": "BreadcrumbList", itemListElement: [] }] };
const html = (blocks: unknown[], extra = "") => `<html><head><title>T</title>${blocks.map((b) => `<script type="application/ld+json">${typeof b === "string" ? b : JSON.stringify(b)}</script>`).join("")}${extra}</head><body></body></html>`;
const page = (url: string, kind: string, name: string, blocks: unknown[], text: string): CheckedPage => ({ url, kind, name, jsonLd: extractPage(html(blocks)).jsonLd, text });

const HOME = page("https://www.mvpmiami.com/", "home", "Home page", [SEO, MVP_BLOCK], "MVP Miami\nCall 786.877.4317\nMonday | 9:30am-9:30pm\n2500 NW 39th Street, Miami");
const RENTALS = page("https://www.mvpmiami.com/rentals/", "other", "Exotic & Luxury Vehicle Rentals", [SEO, MVP_BLOCK], "ROLLS ROYCE CULLINAN\nPrices Starting at: 1,599\nFERRARI F8\nPrices Starting at: 1,499");
const FAQ = page("https://www.mvpmiami.com/faq/", "faq", "FAQ's For Renting Exotic & Luxury Vehicles", [SEO, MVP_BLOCK], "How old do I need to be? 25.");

describe("structured data check", () => {
  it("compares MVP Miami's code with its pages: name, phone, address and hours match; prices and FAQs are missing", () => {
    const r = checkStructuredData([HOME, RENTALS, FAQ], { name: "MVP Miami" });
    expect(r.business).toEqual({ url: "https://www.mvpmiami.com/", type: "AutomotiveBusiness" });
    expect(r.facts.map((f) => [f.fact, f.mark])).toEqual([
      ["Business name", "g"],
      ["Phone", "g"],
      ["Address", "g"],
      ["Hours", "g"],
      ["Prices", "k"],
      ["FAQs", "k"],
    ]);
    expect(r.facts.find((f) => f.fact === "Prices")).toMatchObject({ code: "Only a price range: $$$", title: 'Your pages show prices, but your site\'s code only gives the price range "$$$".', pageUrl: "https://www.mvpmiami.com/rentals/" });
    expect(r.pages.map((p) => p.blocks)).toEqual([2, 2, 2]);
  });

  it("finds conflicts and broken code", () => {
    const wrong = { ...HOME, text: "Call (305) 555-0100\nOpen 9am - 6pm" };
    const broken = page("https://x.com/b", "other", "B", ['{"@type": "Thing",'], "");
    const r = checkStructuredData([wrong, broken], { name: "MVP Miami" });
    expect(r.facts.filter((f) => f.mark === "r").map((f) => f.title)).toEqual([
      "Your pages show (305) 555-0100, but your site's code says +1-786-877-4317.",
      "Your pages say you're open 9am - 6pm, but your site's code says Mo-Su 09:30-21:30.",
    ]);
    expect(r.broken).toEqual([{ url: "https://x.com/b", name: "B", errors: 1 }]);
  });

  it("reads opening hours in both schema.org forms", () => {
    expect(codeHours({ openingHours: "Mo-Fr 08:00-18:00" })).toEqual({ value: "8-18", raw: "Mo-Fr 08:00-18:00" });
    expect(codeHours({ openingHoursSpecification: [{ dayOfWeek: ["https://schema.org/Monday"], opens: "09:00", closes: "17:30" }] })).toEqual({ value: "9-17:30", raw: "Monday 09:00-17:30" });
  });

  it("builds the report's Structured data part: stats, problems in plain English, every fact", () => {
    const sd = websiteStructuredData.parse(buildStructuredData({ version: "x", ...checkStructuredData([HOME, RENTALS, FAQ], { name: "MVP Miami" }), pages: [HOME, RENTALS, FAQ].map((p) => ({ url: p.url, name: p.name, types: [], blocks: 2, errors: 0, codeFrom: null })) }));
    expect(sd.stats.map((s) => `${s.v.value} ${s.v.label}`)).toEqual(["3 of 3 pages have structured data", "4 of 6 facts match your pages", "0 conflicts", "2 facts missing from code"]);
    expect(sd.problems.map((p) => [p.v.tag, p.v.title])).toEqual([
      ["Missing", 'Your pages show prices, but your site\'s code only gives the price range "$$$".'],
      ["Missing", "Your FAQ page answers common questions, but its code doesn't mark them as questions and answers."],
    ]);
    expect(sd.problems[0]!.v.details.map((d) => d.k)).toEqual(["Page", "Where in the code", "Page says", "Fix"]);
  });
});

describe("ws_structured stage", () => {
  it("reads the code from our earlier good plain copy when this run's fetch was refused, and page facts from the browser copy", async () => {
    const { MemoryStore } = await import("../../../engine.test-support");
    const { executeRun } = await import("../../../execute");
    const { registry } = await import("../../../index");
    const store = new MemoryStore(5, 0, []);
    const URL1 = "https://www.mvpmiami.com/";
    const snapRow = (id: string, mode: "raw" | "rendered", status: number, h: string | null, text: string | null, at: string) =>
      store.snapshots.push({ id, reportId: "r1", stageRunId: "x", url: URL1, finalUrl: URL1, fetchMode: mode, userAgent: "t", httpStatus: status, contentHash: null, textHash: null, html: h, text, error: status === 200 ? null : `HTTP ${status}`, fetchedAt: at });
    snapRow("raw-old", "raw", 200, html([MVP_BLOCK]), "old text", "2026-11-17T00:00:02Z");
    snapRow("raw-new", "raw", 403, null, null, "2026-11-17T00:21:00Z");
    snapRow("browser", "rendered", 200, html([]), "Call 786.877.4317\nMonday | 9:30am-9:30pm", "2026-11-17T17:07:00Z");
    const pg = { url: URL1, kind: "home", reason: "Home page", snapshotId: "raw-new", finalUrl: URL1, status: 403, error: "HTTP 403", truncated: false, title: null, description: null, canonical: null, metaRobots: null, headings: [], wordCount: 0, textExcerpt: "", jsonLdTypes: [], jsonLdErrors: 0, microdataTypes: [], permissions: {} };
    const js = { version: "x", counts: { same: 1, minor: 0, content_needs_js: 0, key_facts_need_js: 0, not_checked: 0 }, pages: [{ url: URL1, verdict: "same", label: "Readable", reason: "r", rendered: { snapshotId: "browser", status: 200, finalUrl: URL1, error: null, title: "Home | MVP", durationMs: 1, requests: { fetched: 1, refused: 0, skipped: 0 } }, raw: null, rawWords: 1, renderedWords: 1, addedWords: 0, removedWords: 0, onlyRendered: [], keyFactsOnlyRendered: [], answerKey: { source: "browser", snapshotId: "browser", facts: [] } }] };
    const inputs = [
      { runId: "set", stage: "ws_page_set", output: { pageSet: { id: "00000000-0000-4000-8000-000000000009", version: 2, approvedAt: "x" }, website: URL1, business: { name: "MVP Miami", location: "Miami" }, pages: [{ url: URL1, kind: "home", reason: "Home page" }] }, outputHash: null },
      { runId: "snap", stage: "ws_snapshot", output: { robots: { url: `${URL1}robots.txt`, status: 200, registryVersion: "x" }, pages: [pg] }, outputHash: null },
      { runId: "js", stage: "ws_render", output: js, outputHash: null },
    ];
    store.inputs = inputs as never;
    const def = registry.get("ws_structured")!;
    const out = await executeRun(store, registry, { id: "st-1", reportId: "r1", stage: "ws_structured", version: 1, attempt: 1, maxAttempts: 2, timeoutMs: def.timeoutMs, params: {}, inputRunIds: ["set", "snap", "js"], instructions: [] }, undefined, {});
    expect(out.outcome).toBe("done");
    const sc = store.finished!.output as unknown as { pages: { codeFrom: unknown; blocks: number }[]; facts: { fact: string; mark: string }[] };
    expect(sc.pages[0]).toMatchObject({ blocks: 1, codeFrom: { snapshotId: "raw-old", source: "plain", fetchedAt: "2026-11-17T00:00:02Z" } });
    expect(sc.facts.map((f) => [f.fact, f.mark])).toEqual([["Business name", "g"], ["Phone", "g"], ["Hours", "g"]]);
  });
});
