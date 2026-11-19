// Service lines (owner decision, 19 Nov 2026): each line gets its own cited pages (up to 20) and its own citation map
// with its top 15 competitors; lines with fewer than 3 questions get no map; another business's own website isn't an
// outside site.
import { describe, expect, it } from "vitest";
import { PAGE_CAP, choosePages, ownSiteOf, type SectionPages } from "../logic/pages";
import { buildCitationCoverage, type CitedPagesInput, type CoverageAnswers } from "../logic/section";

describe("another business's own website", () => {
  const BIZ = [
    { key: "EMCR", name: "Exotic Miami Car Rental" },
    { key: "MC", name: "mph club" },
    { key: "AZ", name: "Azimut" },
  ];
  it("matches the site's name written together, allowing one word left out of a 3+ word name", () => {
    expect(ownSiteOf("exoticmiamirental.com", BIZ)).toBe("EMCR");
    expect(ownSiteOf("www.exoticmiamicarrental.com", BIZ)).toBe("EMCR");
    expect(ownSiteOf("mphclub.com", BIZ)).toBe("MC");
    expect(ownSiteOf("carrentallist.com", BIZ)).toBeNull();
    expect(ownSiteOf("azimut.it", BIZ)).toBe("AZ");
    expect(ownSiteOf("mph.com", [{ key: "M", name: "MPH" }])).toBeNull(); // too short a name to judge from the site alone
  });
});

const page = (key: string, category: string, site = `${key}.com`) => ({ v: { key, url: `https://${site}/${key}`, category, site } });
const ok = (citations: string[], named: string[] = []) => ({ v: { status: "ok", citations, named: named.map((business) => ({ business, status: "R" })) } });

describe("choosing pages per service line", () => {
  // 25 car pages cited by P1 (more by P2 too), 2 yacht pages cited by P7, and a competitor's own site left unclassified.
  const car = Array.from({ length: 25 }, (_, i) => `dr${i + 1}`);
  const section: SectionPages = {
    pages: [...car.map((k) => page(k, "dir")), page("yt1", "dir"), page("yt2", "ed"), page("un1", "unc", "exoticmiamirental.com")],
    questions: [
      { question: { v: { id: "P1" } }, answers: [ok([...car, "un1"]), ok(["yt1"])] },
      { question: { v: { id: "P2" } }, answers: [ok([...car.slice(0, 3), "yt1"])] },
      { question: { v: { id: "P7" } }, answers: [ok(["yt1", "yt2"])] },
    ],
  };
  const biz = [{ key: "EMCR", name: "Exotic Miami Car Rental" }];

  it("without lines: the 20 most-cited pages, as before, minus competitors' own sites", () => {
    const r = choosePages(section, biz, null);
    expect(r.chosen).toHaveLength(PAGE_CAP);
    expect(r.chosen.slice(0, 3).map((p) => p.key)).toEqual(["yt1", "dr1", "dr2"]); // yt1: cited in 3 questions
    expect(r.chosen.some((p) => p.key === "un1")).toBe(false);
    expect(r).toMatchObject({ outside: 27, ownSites: 1 });
  });

  it("with lines: up to 20 per line, ranked by that line's questions; a page chosen twice is checked once", () => {
    const r = choosePages(section, biz, [
      { name: "Cars", questions: ["P1", "P2"] },
      { name: "Yachts", questions: ["P7"] },
    ]);
    const lines = (k: string) => r.chosen.find((p) => p.key === k)?.lines;
    expect(r.chosen.filter((p) => p.lines.includes("Cars"))).toHaveLength(20);
    expect(lines("yt1")).toEqual(["Cars", "Yachts"]); // car questions cite yt1 too
    expect(lines("yt2")).toEqual(["Yachts"]);
    expect(lines("dr9")).toBeUndefined(); // past the 20th car page (ties broken by page key): left out
    expect(r.chosen.find((p) => p.key === "yt1")).toMatchObject({ prompts: 3 }); // counts stay report-wide (P1, P2, P7)
  });
});

describe("one citation map per line", () => {
  const competitors = Array.from({ length: 17 }, (_, i) => `C${String(i + 1).padStart(2, "0")}`);
  const pa: CoverageAnswers = {
    businesses: [{ v: { key: "MM", name: "MVP Miami" } }, ...competitors.map((k) => ({ v: { key: k, name: `Company ${k}` } })), { v: { key: "Y1", name: "Yacht Co" } }],
    questions: [
      // C01 named in 3 answers, C02 in 2, the rest once; C17 only in an unavailable answer.
      { question: { v: { id: "P1" } }, answers: [ok(["dr1", "dr2"], ["C01", "C02", "MM"]), ok(["dr3"], ["C01", "C02"]), { v: { status: "unavailable" } }] },
      { question: { v: { id: "P2" } }, answers: [ok(["dr4"], ["C01", ...competitors.slice(2, 16)])] },
      { question: { v: { id: "P7" } }, answers: [ok(["yt1"], ["Y1"])] },
    ],
  };
  const pg = (key: string, site: string, names: string[], lines: string[], state: "checked" | "unchecked" = "checked") => ({
    key, url: `https://${site}/${key}`, site, category: "dir" as const, title: null, prompts: 1, answers: 1, engines: [0], lines, state,
    reason: state === "checked" ? null : "The site's robots.txt asks checkers like ours not to fetch this page (disallowed).",
    source: null, excerpt: null, attempts: [], names: names.map((business) => ({ business, excerpt: "" })),
  });
  const cp: CitedPagesInput = {
    version: "x", cap: 20, outsidePages: 6, ownSites: 1, runId: "wp-1", finishedAt: "2026-11-19T00:00:00Z",
    businesses: [{ key: "MM", name: "MVP Miami", target: true }],
    lines: [{ name: "Cars", questions: ["P1", "P2"] }, { name: "Yachts", questions: ["P7"] }],
    pages: [
      pg("dr1", "listA.com", ["MM", "C01"], ["Cars"]),
      pg("dr2", "listA.com", ["C16"], ["Cars"]),
      pg("dr3", "boats.com", [], ["Cars"]), // names nobody: cited for facts
      pg("dr4", "yelp.com", [], ["Cars"], "unchecked"),
      pg("yt1", "yachts.com", ["Y1"], ["Yachts"]),
    ],
  };

  it("columns: you, then the line's 15 most-named competitors; rows only for sites naming one of them", () => {
    const [cars, yachts] = buildCitationCoverage(cp, pa);
    expect(cars!.line!.v).toEqual({ name: "Cars", questions: ["P1", "P2"] });
    expect(cars!.businesses.v).toEqual(["MM", "C01", "C02", ...competitors.slice(2, 15)]);
    expect(cars!.businesses.v).toHaveLength(16);
    expect(cars!.sites.map((s) => [s.v.name, s.v.pageKeys, s.v.presentBusinesses])).toEqual([["listA.com", ["dr1", "dr2"], ["MM", "C01"]]]); // C16 is 16th
    expect(cars!.scope!.v).toContain("1 more site named none of these businesses");
    expect(cars!.scope!.v).toContain("1 more page couldn't be read and isn't shown: 1 asks checkers like ours not to fetch it (robots.txt)");
    expect(cars!.scope!.v).toContain("Columns show you and the 15 businesses AI named most in the 2 questions of this line (the second table continues the first).");
    expect(cars!.scope!.v).toContain("1 cited page on other businesses' own websites isn't counted as outside sites.");
    expect(yachts!.businesses.v).toEqual(["MM", "Y1"]);
    expect(yachts!.sites.map((s) => s.v.name)).toEqual(["yachts.com"]);
  });
});

describe("no line with enough questions", () => {
  it("gives no map (the slide is left out)", () => {
    const cp: CitedPagesInput = { version: "x", cap: 20, outsidePages: 0, runId: "wp", finishedAt: "2026-11-19T00:00:00Z", businesses: [{ key: "MM", name: "MVP Miami", target: true }], lines: [], pages: [] };
    expect(buildCitationCoverage(cp, { businesses: [], questions: [] })).toEqual([]);
  });
});
