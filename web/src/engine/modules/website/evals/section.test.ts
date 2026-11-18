// Website: the report's Find & read part, built from the website stages (plain code).
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { reportDocument, websiteDiscovery } from "@/report/schema";
import type { JsCheck } from "../js-stage";
import { buildDiscovery, discoveryCopy, pageName, sectionEvidence, type SectionInputs } from "../logic/section";
import type { PageSetSpec, Snapshots } from "../schemas";
import type { FindRead } from "../test-stages";

const allowed = { verdict: "allowed" as const, line: null, reason: "No rule" };
const perms = { "OAI-SearchBot": allowed, "ChatGPT-User": allowed, "Claude-SearchBot": allowed, "Claude-User": allowed, Googlebot: allowed };
const page = (url: string, kind: Snapshots["pages"][number]["kind"], title: string, reason: string): Snapshots["pages"][number] => ({
  url, kind, reason, snapshotId: `s-${kind}`, finalUrl: url, status: 200, error: null, truncated: false, title, description: null, canonical: null, metaRobots: null,
  headings: [], wordCount: 100, textExcerpt: "", jsonLdTypes: [], jsonLdErrors: 0, microdataTypes: [], permissions: perms,
});
const HOME = "https://www.mvpmiami.com/";
const RENTALS = "https://www.mvpmiami.com/rentals/";
const FAQ = "https://www.mvpmiami.com/faq/";

const set: PageSetSpec & { runId: string } = {
  runId: "set-1",
  pageSet: { id: "00000000-0000-4000-8000-000000000009", version: 3, approvedAt: "2026-11-17T00:20:00Z" },
  website: HOME,
  business: { name: "MVP Miami", location: "Miami, FL" },
  pages: [],
};
const snap: Snapshots & { runId: string } = {
  runId: "snap-1",
  robots: { url: `${HOME}robots.txt`, status: 200, registryVersion: "2026-11-17" },
  pages: [page(HOME, "home", "Exotic Car Rentals | MVP Miami", "Home page"), page(RENTALS, "pricing", "Exotic Vehicle Rentals | MVP Miami", "Prices and inventory"), page(FAQ, "faq", "FAQ's For Renting | MVP Miami", "FAQ page")],
};
const r = (search: string, read: string, label: string, extra: object = {}) => ({ search, read, label, ...extra }) as FindRead["pages"][number]["results"][number];
const findRead: FindRead & { runId: string; finishedAt: string } = {
  runId: "fr-1",
  finishedAt: "2026-11-17T17:18:50Z",
  selectedPageCount: 3,
  foundAndRead: [1, 1, 2],
  pages: [
    { url: HOME, kind: "home", reason: "Home page", title: null, results: [r("found", "readable", "Found & read"), r("found", "readable", "Found & read"), r("found", "readable", "Found & read")] },
    {
      url: RENTALS, kind: "pricing", reason: "Prices", title: null,
      results: [
        r("found", "partial", "Found; partly read", { note: "Got 2 of 8 key facts.", extraction: { got: 2, of: 8, missed: [], missedJsOnly: 6, itemsOnPage: 0, itemsNamed: 0, answerKey: "browser" } }),
        r("not_found", "partial", "Not found in search; partly read", { extraction: { got: 2, of: 8, missed: [], missedJsOnly: 6, itemsOnPage: 0, itemsNamed: 0, answerKey: "browser" } }),
        r("not_found", "readable", "Read using direct link; not found in search", { extraction: { got: 8, of: 8, missed: [], missedJsOnly: 0, itemsOnPage: 9, itemsNamed: 9, answerKey: "browser" } }),
      ],
    },
    { url: FAQ, kind: "faq", reason: "FAQ page", title: null, results: [r("found", "unconfirmed", "Found; reading unconfirmed"), r("found", "unsuccessful", "Found, but could not read"), r("unconfirmed", "readable", "Search unconfirmed; read")] },
  ],
};
const jsPage = (url: string, verdict: JsCheck["pages"][number]["verdict"], label: string, words: [number, number], extra: object = {}) =>
  ({ url, verdict, label, reason: "r", rendered: { snapshotId: "x", status: 200, finalUrl: url, error: null, title: null, durationMs: 1, requests: { fetched: 1, refused: 0, skipped: 0 } }, raw: null, rawWords: words[0], renderedWords: words[1], addedWords: 0, removedWords: 0, onlyRendered: [], keyFactsOnlyRendered: [], answerKey: null, ...extra }) as JsCheck["pages"][number];
const js: JsCheck & { runId: string; finishedAt: string } = {
  runId: "js-1",
  finishedAt: "2026-11-17T17:07:00Z",
  version: "x",
  counts: { same: 1, minor: 0, content_needs_js: 0, key_facts_need_js: 1, not_checked: 1 },
  pages: [
    jsPage(HOME, "same", "Readable without JavaScript", [410, 410]),
    jsPage(RENTALS, "key_facts_need_js", "Key facts load with JavaScript", [72, 1292], { reason: "Prices appear only after scripts run (6 found, e.g. Prices Starting at: 1,599).", recommendation: "Your prices depend on JavaScript. Making them available immediately removes one potential barrier to reading them." }),
    jsPage(FAQ, "not_checked", "Couldn't check", [1048, 0]),
  ],
};
const inputs: SectionInputs = { set, snap, findRead, js, snapshotAt: "2026-11-17T00:21:01Z" };

describe("website section: Find & read", () => {
  const d = websiteDiscovery.parse(buildDiscovery(inputs));

  it("answers the three questions per page and AI: found, blocked, read; unconfirmed is never a failure", () => {
    expect(d.pageGroups.map((g) => g.group.v.title)).toEqual(["Main pages", "Services, prices and booking", "Questions and policies"]);
    const faq = d.pageGroups[2]!.pages[0]!;
    expect(faq.page.v).toEqual({ name: "FAQ's For Renting", url: FAQ, why: "FAQ page" });
    // ChatGPT: found, not blocked (your rules allow it), reading not confirmed. Claude: found, but your website turned its
    // reader away, so blocked and not asked to read. Gemini: search not confirmed, not blocked, read.
    expect(faq.results.map((x) => x.v)).toEqual([
      { search: "g", access: "g", read: "u" },
      { search: "g", access: "r", read: "n" },
      { search: "d", access: "g", read: "g" },
    ]);
    // Rentals: ChatGPT and Claude missed prices that only load with JavaScript.
    expect(d.pageGroups[1]!.pages[0]!.results.map((x) => x.v.read)).toEqual(["j", "j", "g"]);
    expect(d.permissions.map((p) => p.v.mark)).toEqual(["g", "g", "g"]);
  });

  it("carries the key-fact notes, our JavaScript check (checked pages only) and what to fix first", () => {
    expect(d.notes.map((n) => n.v)).toContainEqual({ page: "Exotic Vehicle Rentals", engine: 0, text: "Got 2 of 8 key facts.", step: 3 });
    expect(d.notes.map((n) => n.v)).toContainEqual({ page: "FAQ's For Renting", engine: 1, text: "Your website turned Claude's page reader away.", step: 2 });
    expect(d.rawVsLoaded.v).toEqual([
      { page: "Home page", raw: "410 words", loaded: "410 words", mark: "g", result: "Readable without JavaScript" },
      { page: "Exotic Vehicle Rentals", raw: "72 words", loaded: "1,292 words", mark: "r", result: "Key facts load with JavaScript" },
    ]);
    // Each item names its step and matches that step's table.
    expect(d.attention.map((a) => a.v.title)).toEqual(["Step 2: Claude is blocked from 1 page", "Step 3: ChatGPT and Claude can't read Exotic Vehicle Rentals: it needs JavaScript"]);
    expect(d.attention[0]!.v.what).toBe("FAQ's For Renting. Your website's security settings stopped Claude's page reader, so it can't use these pages.");
    expect(d.attention[1]!.v).toMatchObject({ engines: [0, 1], what: expect.stringContaining("ChatGPT and Claude didn't get them."), next: expect.stringMatching(/^Your prices depend on JavaScript/) });
  });

  it("names pages by title, then our browser copy's title, then the address; never by the reason they were chosen", () => {
    const pg = { kind: "other", title: null, url: "https://www.mvpmiami.com/luxury-yacht-rentals-miami/" };
    expect(pageName(pg)).toBe("Luxury yacht rentals miami");
    expect(pageName(pg, "Luxury Yacht Rentals Miami | MVP Miami")).toBe("Luxury Yacht Rentals Miami");
    expect(pageName({ ...pg, title: "Yachts | MVP" }, "Other")).toBe("Yachts");
  });

  it("says the JavaScript check is missing rather than showing nothing", () => {
    expect(buildDiscovery({ ...inputs, js: null }).rawVsLoaded).toEqual({ v: null, p: { kind: "missing", reason: "Our JavaScript check hasn't run for this report." } });
  });

  it("gives every envelope evidence that the section's registry defines", () => {
    const ev = sectionEvidence(inputs);
    const ids = new Set(JSON.stringify(buildDiscovery(inputs)).match(/"ws-[a-z-]+"/g)!.map((x) => JSON.parse(x) as string));
    for (const id of ids) expect(ev[id], id).toBeDefined();
    expect(ev["ws-findread"]).toMatchObject({ capturedOn: "2026-11-17", ref: "stage_run fr-1" });
    expect(discoveryCopy(inputs).discoveryIntro.v).toContain("We checked 3 pages");
  });
});

describe("report document with the website's Find & read part", () => {
  it("validates with the other website parts left out, and its evidence ids resolve", () => {
    const doc = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../../../../../../fixtures/mvp-miami.json"), "utf8")) as Record<string, unknown>;
    for (const k of ["summary", "competitors", "citationCoverage", "webPresence", "credible", "actions", "methodGroups"]) doc[k] = null;
    doc.website = { discovery: buildDiscovery(inputs), structuredData: null, clear: null, consistent: null, distinctive: null };
    doc.evidence = { ...(doc.evidence as object), ...sectionEvidence(inputs) };
    const parsed = reportDocument.safeParse(doc);
    expect(parsed.success, parsed.success ? "" : JSON.stringify(parsed.error.issues.slice(0, 3))).toBe(true);
  });
});
