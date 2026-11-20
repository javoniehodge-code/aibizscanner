import { expect, test } from "@playwright/test";
import fs from "node:fs";
import { captureSlides, currentTemplate, diffRatio, fixture, legacyTemplate, serveDir, SLIDE_COUNT, templateDir } from "./report-harness";

// These tests render the design template directly (no app, no database).
test.describe.configure({ mode: "serial" });
test.setTimeout(240_000);

/**
 * Slide indexes changed on purpose since the original: 5 Businesses named (top 15, no first-choice chart, slanted
 * names; 14 Nov 2026); 9 Find & read (one table per question: find, blocked, read; 18 Nov 2026); 15 Sources (websites
 * summary, drilldowns by website and provider tab; 16 Nov 2026).
 */
const REDESIGNED = new Set([5, 9, 15]);

test("Brownstone: every slide matches the original hand-filled template, except redesigned ones", async ({ browser }) => {
  const before = await serveDir(templateDir(legacyTemplate()));
  const after = await serveDir(templateDir(currentTemplate()));
  try {
    const pa = await browser.newPage({ deviceScaleFactor: 1 });
    const pb = await browser.newPage({ deviceScaleFactor: 1 });
    const original = await captureSlides(pa, `${before.url}/report.html`);
    const fromJson = await captureSlides(pb, `${after.url}/report.html`, fixture("brownstone"));
    expect(original.errors).toEqual([]);
    expect(fromJson.errors).toEqual([]);
    const cmp = await browser.newPage();
    for (let i = 0; i < SLIDE_COUNT; i++) {
      // Redesigned after the JSON refactor, so they no longer match the original (checked in the MVP Miami test).
      if (REDESIGNED.has(i)) continue;
      const o = original.slides[i]!, n = fromJson.slides[i]!;
      expect(n.text, `slide ${i}: visible text`).toBe(o.text);
      // Text from a data hole is its own text run, which can shift anti-aliasing by a fraction of a pixel, and one
      // dot in the generated Credible diagram sits 0.05 units from the original. Anything real is far above this.
      const ratio = await diffRatio(cmp, o.png, n.png);
      expect(ratio, `slide ${i}: share of differing pixels`).toBeLessThan(0.001);
    }
  } finally {
    await before.close();
    await after.close();
  }
});

test("MVP Miami renders through the same template with no template edits", async ({ browser }) => {
  const srv = await serveDir(templateDir(currentTemplate()));
  try {
    const page = await browser.newPage({ deviceScaleFactor: 1 });
    const { slides, errors } = await captureSlides(page, `${srv.url}/report.html`, fixture("mvp-miami"));
    expect(errors).toEqual([]);
    expect(slides).toHaveLength(SLIDE_COUNT);
    const all = slides.map((s) => s.text).join("\n");
    expect(all).toContain("MVP Miami");
    for (const leftover of ["Brownstone", "Brooklyn", "NYSDOT", "29 Oct 2026"]) expect(all).not.toContain(leftover);
    // Missing states, not Brownstone values.
    expect(all).toContain("Not available for this report: The MVP Miami export has no raw-vs-fully-loaded comparison table.");
    expect(all).toContain("Not recorded for this report: The MVP Miami export did not record sources named without a citation (XSRC).");
    // Businesses named (slide 5): two charts limited to the top 15 of 20 businesses, no first-choice chart.
    const names = slides[5]!.text;
    expect(names).toContain("Showing the 15 highest of 20 businesses named.");
    expect(names).toContain("2. Recommended");
    expect(names).not.toContain("3. Explicit first choice");
  } finally {
    await srv.close();
  }
});

test("a report with only the prompt analysis shows only its slides, numbered in order", async ({ browser }) => {
  // What pipeline stage 12 produces before the website and web presence stages exist: those sections are null.
  const doc = fixture("mvp-miami") as Record<string, unknown>;
  for (const k of ["summary", "competitors", "citationCoverage", "webPresence", "website", "credible", "actions", "methodGroups"]) doc[k] = null;
  const srv = await serveDir(templateDir(currentTemplate()));
  try {
    const page = await browser.newPage({ deviceScaleFactor: 1 });
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (r) => r.abort());
    await page.addInitScript((r) => ((window as unknown as { __REPORT__: unknown }).__REPORT__ = r), doc);
    await page.goto(`${srv.url}/report.html`);
    const slide = page.locator("#dc-root section").first();
    await slide.waitFor({ timeout: 30_000 });
    const slides: string[] = [];
    for (let i = 0; i < 11; i++) {
      await page.waitForTimeout(120);
      slides.push(await slide.innerText());
      await page.keyboard.press("ArrowRight");
    }
    expect(errors).toEqual([]);
    const heads = slides.map((t) => t.split("\n")[0]!.trim());
    // Cover, AI Recommendation divider, guide, summary, prompts, businesses, Web Presence divider, sources, appendix,
    // prompt method; the 11th press stays on the last slide.
    expect(heads).toEqual(["ABOUT THIS REPORT", "SECTION 1", "02", "03", "04", "05", "SECTION 2", "07", "REFERENCE", "09", "09"]);
    const all = slides.join("\n");
    expect(all).toContain("NOT IN THIS REPORT YET");
    for (const absent of ["AI Analysis of Your Website", "Action Plan", "Competitor Comparison", "Citation coverage"]) expect(all).not.toContain(absent);
  } finally {
    await srv.close();
  }
});

test("a report with the website's Find & read part only shows that website slide", async ({ browser }) => {
  // What stage 12 produces once the website tests have run but before structured data, Clear & complete, Consistent and
  // Distinctive exist: website has only its discovery part.
  const doc = fixture("mvp-miami") as Record<string, unknown> & { website: Record<string, unknown> };
  for (const k of ["summary", "competitors", "citationCoverage", "webPresence", "credible", "actions", "methodGroups"]) doc[k] = null;
  for (const k of ["structuredData", "clear", "consistent", "distinctive"]) doc.website[k] = null;
  const srv = await serveDir(templateDir(currentTemplate()));
  try {
    const page = await browser.newPage({ deviceScaleFactor: 1 });
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (r) => r.abort());
    await page.addInitScript((r) => ((window as unknown as { __REPORT__: unknown }).__REPORT__ = r), doc);
    await page.goto(`${srv.url}/report.html`);
    const slide = page.locator("#dc-root section").first();
    await slide.waitFor({ timeout: 30_000 });
    const slides: string[] = [];
    for (let i = 0; i < 13; i++) {
      await page.waitForTimeout(120);
      slides.push(await slide.innerText());
      await page.keyboard.press("ArrowRight");
    }
    expect(errors).toEqual([]);
    const heads = slides.map((t) => t.split("\n").slice(0, 2).join(" | ").trim());
    expect(heads.slice(6, 9)).toEqual(["SECTION 2 | MVP Miami", "07 | FIND & READ", "SECTION 3 | MVP Miami"]);
    // One table per question (owner, 18 Nov 2026).
    for (const step of ["Can AI find this page?", "Can AI access this page?", "Can AI read this page?"]) expect(slides[7]).toContain(step);
    const all = slides.join("\n");
    for (const absent of ["CLEAR & COMPLETE", "CONSISTENT & CURRENT", "DISTINCTIVE & RELEVANT", "Structured data is code on your pages"]) expect(all).not.toContain(absent);
  } finally {
    await srv.close();
  }
});

test("a report with Citation coverage from the cited-page check shows that slide with its scope line", async ({ browser }) => {
  // What stage 12 produces once wp_section has run: prompt analysis plus citationCoverage, with the scope line.
  const doc = fixture("mvp-miami") as Record<string, unknown> & { citationCoverage: Record<string, unknown> };
  for (const k of ["summary", "competitors", "webPresence", "website", "credible", "actions", "methodGroups"]) doc[k] = null;
  doc.citationCoverage.scope = { v: "We read the 12 outside pages AI cited most (we check up to 20 per report).", p: { kind: "observed", evidence: [] } };
  const srv = await serveDir(templateDir(currentTemplate()));
  try {
    const page = await browser.newPage({ deviceScaleFactor: 1 });
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (r) => r.abort());
    await page.addInitScript((r) => ((window as unknown as { __REPORT__: unknown }).__REPORT__ = r), doc);
    await page.goto(`${srv.url}/report.html`);
    const slide = page.locator("#dc-root section").first();
    await slide.waitFor({ timeout: 30_000 });
    const slides: string[] = [];
    for (let i = 0; i < 12; i++) {
      await page.waitForTimeout(120);
      slides.push(await slide.innerText());
      await page.keyboard.press("ArrowRight");
    }
    expect(errors).toEqual([]);
    const cov = slides.find((t) => t.includes("CITATION COVERAGE MAP"));
    expect(cov).toBeDefined();
    expect(cov).toContain("We read the 12 outside pages AI cited most (we check up to 20 per report).");
    expect(slides.join("\n")).not.toContain("CREDIBLE & CORROBORATED");
  } finally {
    await srv.close();
  }
});

test("service lines: one Citation coverage slide per line, you and 7 competitors, then the rest in a second table", async ({ browser }) => {
  // What wp_section produces with service lines saved: a list of maps, each with its line, questions and up to 15
  // competitors in rank order (you first).
  type Env<T> = { v: T; p: unknown };
  const doc = fixture("mvp-miami") as Record<string, unknown> & {
    citationCoverage: { sites: Env<{ name: string; presentBusinesses: string[] }>[]; businesses: Env<string[]> };
    promptAnalysis: { businesses: Env<{ key: string; name: string }>[]; questions: { question: Env<{ id: string }> }[] };
  };
  for (const k of ["summary", "competitors", "webPresence", "website", "credible", "actions", "methodGroups"]) doc[k] = null;
  const obs = <T>(v: T) => ({ v, p: { kind: "observed", evidence: [] } });
  const one = doc.citationCoverage;
  const keys = doc.promptAnalysis.businesses.map((b) => b.v.key);
  const target = one.businesses.v[0]!;
  const ranked = [target, ...keys.filter((k) => k !== target)].slice(0, 12);
  const ids = doc.promptAnalysis.questions.map((q) => q.question.v.id);
  doc.citationCoverage = [
    { ...one, line: obs({ name: "Car rental", questions: ids.slice(0, 4) }), businesses: obs(ranked), scope: obs("Car rental scope line.") },
    { ...one, line: obs({ name: "Yachts", questions: ids.slice(4, 7) }), businesses: obs(ranked.slice(0, 3)), scope: obs("Yachts scope line.") },
  ] as unknown as typeof one;
  const name = (k: string) => doc.promptAnalysis.businesses.find((b) => b.v.key === k)!.v.name;
  const srv = await serveDir(templateDir(currentTemplate()));
  try {
    const page = await browser.newPage({ deviceScaleFactor: 1 });
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (r) => r.abort());
    await page.addInitScript((r) => ((window as unknown as { __REPORT__: unknown }).__REPORT__ = r), doc);
    await page.goto(`${srv.url}/report.html`);
    const slide = page.locator("#dc-root section").first();
    await slide.waitFor({ timeout: 30_000 });
    const slides: string[] = [];
    for (let i = 0; i < 14; i++) {
      await page.waitForTimeout(120);
      slides.push(await slide.innerText());
      await page.keyboard.press("ArrowRight");
    }
    expect(errors).toEqual([]);
    const cov = slides.filter((t) => t.includes("CITATION COVERAGE MAP"));
    expect(cov).toHaveLength(2);
    expect(cov[0]).toContain("Car rental");
    expect(cov[0]).toContain("Car rental scope line.");
    expect(cov[0]).toContain("Competitors 8\u201311 on the same sites");
    // Columns keep the rank order: you and competitors 1-7 in the first table, 8-11 in the second.
    const heads = (t: string, n: number) => t.trim().split("\n").filter((l) => l !== "YOU").slice(0, n);
    const [, first, second] = cov[0]!.split("Cited site");
    expect(heads(first!, 8)).toEqual(ranked.slice(0, 8).map(name));
    expect(heads(second!, 4)).toEqual(ranked.slice(8).map(name));
    expect(cov[1]).toContain("Yachts");
    expect(cov[1]).toContain("Yachts scope line.");
    expect(cov[1]).not.toContain("Competitors 8");
    // Each line's slide has its own number, following on.
    const nums = cov.map((t) => Number(t.match(/^\s*(\d+)/)?.[1]));
    expect(nums[1]).toBe(nums[0]! + 1);
  } finally {
    await srv.close();
  }
});

test("Consistent & current from the pipeline: Agree or Don't agree, one column per source, and the facts not mentioned", async ({ browser }) => {
  // What wp_section produces (part 4c-1): two outcomes only, the sources that give values, and notMentioned.
  type Env<T> = { v: T; p: unknown };
  const doc = fixture("mvp-miami") as Record<string, unknown> & { website: Record<string, unknown> };
  for (const k of ["summary", "competitors", "citationCoverage", "webPresence", "credible", "actions", "methodGroups"]) doc[k] = null;
  for (const k of ["discovery", "structuredData", "clear", "distinctive"]) doc.website[k] = null;
  const obs = <T>(v: T): Env<T> => ({ v, p: { kind: "observed", evidence: [] } });
  doc.website.consistent = {
    intro: obs("We compare the facts on your website with what the outside pages AI cited say about you."),
    verdict: obs({ heading: "1 of 2 facts we could compare doesn't agree", text: "We compared your website with 2 outside sites AI cited that name you." }),
    sources: [obs({ name: "carrentallist.com", sub: "Directory & marketplace" }), obs({ name: "respectmyregion.com", sub: "Editorial & publication" })],
    facts: [
      obs({ name: "How to book and contact", website: { value: "(305) 555-0100", pages: "Home", issue: null }, sources: [{ text: "305-555-0100", mark: "g" }, { text: "(305) 555-0100", mark: "g" }], status: "a", means: "2 other sources say the same as your website.", note: null }),
      obs({ name: "Rental requirements", website: { value: "25 years", pages: "FAQ", issue: null }, sources: [{ text: "21+", mark: "r" }, { text: "Not mentioned", mark: "n" }], status: "c", means: "Sources disagree.", note: "carrentallist.com says 21+; your website says 25 years." }),
    ],
    notMentioned: [obs({ name: "Deposit and payment", website: null, note: "Your website doesn't give this; carrentallist.com says $2,000." })],
    fixes: [obs({ title: "Correct the rental requirements on carrentallist.com", where: "carrentallist.com says 21+; your website says 25 years.", why: "AI can repeat whichever version it finds." })],
    rules: [obs({ k: "Agree", v: "At least one other source says the same as your website." })],
  };
  const srv = await serveDir(templateDir(currentTemplate()));
  try {
    const page = await browser.newPage({ deviceScaleFactor: 1 });
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (r) => r.abort());
    await page.addInitScript((r) => ((window as unknown as { __REPORT__: unknown }).__REPORT__ = r), doc);
    await page.goto(`${srv.url}/report.html`);
    const slide = page.locator("#dc-root section").first();
    await slide.waitFor({ timeout: 30_000 });
    let text = "";
    for (let i = 0; i < 16 && !text.includes("CONSISTENT & CURRENT"); i++) {
      await page.keyboard.press("ArrowRight");
      await page.waitForTimeout(120);
      const t = await slide.innerText();
      if (t.includes("Do your sources tell the same story?")) text = t;
    }
    expect(errors).toEqual([]);
    expect(text).toContain("1 of 2 facts we could compare doesn't agree");
    expect(text).toMatch(/1\s*of 2 facts\s*\S*\s*Agree/);
    expect(text).toContain("Don\u2019t agree");
    expect(text).not.toContain("Not enough to confirm");
    expect(text).not.toContain("\u201cCurrent\u201d needs support");
    expect(text).toContain("carrentallist.com");
    expect(text).toContain("Not mentioned by other sources");
    expect(text).toContain("Your website doesn't give this; carrentallist.com says $2,000.");
    expect(text).toContain("Correct the rental requirements on carrentallist.com");
    // Two source columns: each fact row has exactly the two cells.
    expect(await page.locator("section .cc-grid").first().locator(":scope > span").count()).toBe(5); // fact, website, 2 sources, meaning
  } finally {
    await srv.close();
  }
});

test("Credible: a page we couldn't read shows as couldn't check, and no reviews means no reviews block", async ({ browser }) => {
  // What stage 12 produces once wp_assess has run: credible and webPresence from the cited pages we read.
  const doc = fixture("mvp-miami") as Record<string, unknown> & { credible: { pages: { v: { presence: string } }[]; reviews: unknown[] } };
  for (const k of ["summary", "competitors", "website", "actions", "methodGroups"]) doc[k] = null;
  doc.credible.pages[0]!.v.presence = "unchecked";
  doc.credible.reviews = [];
  const srv = await serveDir(templateDir(currentTemplate()));
  try {
    const page = await browser.newPage({ deviceScaleFactor: 1 });
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (r) => r.abort());
    await page.addInitScript((r) => ((window as unknown as { __REPORT__: unknown }).__REPORT__ = r), doc);
    await page.goto(`${srv.url}/report.html`);
    const slide = page.locator("#dc-root section").first();
    await slide.waitFor({ timeout: 30_000 });
    const slides: string[] = [];
    for (let i = 0; i < 14; i++) {
      await page.waitForTimeout(120);
      slides.push(await slide.innerText());
      await page.keyboard.press("ArrowRight");
    }
    expect(errors).toEqual([]);
    const cred = slides.find((t) => t.includes("CREDIBLE & CORROBORATED"));
    expect(cred).toBeDefined();
    expect(cred).not.toContain("What customers say");
    const all = slides.join("\n");
    expect(all).toContain("Couldn\u2019t check the page");
  } finally {
    await srv.close();
  }
});

test("Credible: the absence banner counts only pages we could read", async ({ browser }) => {
  const doc = fixture("mvp-miami") as Record<string, unknown> & { credible: { pages: { v: { presence: string } }[]; web: { sites: { v: Record<string, unknown> }[] } } };
  for (const k of ["summary", "competitors", "website", "actions", "methodGroups"]) doc[k] = null;
  doc.credible.pages.forEach((p, i) => (p.v.presence = i === 0 ? "unchecked" : "none"));
  const read = doc.credible.pages.length - 1;
  const srv = await serveDir(templateDir(currentTemplate()));
  try {
    const page = await browser.newPage({ deviceScaleFactor: 1 });
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (r) => r.abort());
    await page.addInitScript((r) => ((window as unknown as { __REPORT__: unknown }).__REPORT__ = r), doc);
    await page.goto(`${srv.url}/report.html`);
    const slide = page.locator("#dc-root section").first();
    await slide.waitFor({ timeout: 30_000 });
    const slides: string[] = [];
    for (let i = 0; i < 14; i++) {
      await page.waitForTimeout(120);
      slides.push(await slide.innerText());
      await page.keyboard.press("ArrowRight");
    }
    expect(errors).toEqual([]);
    const all = slides.join("\n");
    expect(all).toContain(`You don\u2019t appear on any of the ${read} outside pages we could read.`);
    expect(all).toContain("We couldn\u2019t read 1 more page, so we can\u2019t say whether you\u2019re on it.");
    expect(all).not.toContain("Every page AI relied on names other businesses instead");
  } finally {
    await srv.close();
  }
});

test("Credible: a Google review card shows each review's author and the Google Maps attribution", async ({ browser }) => {
  const doc = fixture("mvp-miami") as Record<string, unknown> & { credible: { reviews: unknown[] } };
  for (const k of ["summary", "competitors", "website", "actions", "methodGroups"]) doc[k] = null;
  doc.credible.reviews = [{ v: { label: "Google", title: "MVP Miami", rating: "4.9", count: "412", recent: "Latest review shown: 2 weeks ago", themes: "The 1 reviews Google shows, as Google shows them:", cited: false, scale: 5,
    items: [{ author: "Ana R.", authorUrl: "https://www.google.com/maps/contrib/1", rating: 5, when: "2 weeks ago", text: "Great cars and service.", url: "https://www.google.com/maps/reviews/1" }],
    attribution: { text: "Google Maps", url: "https://maps.google.com/?cid=9" } }, p: { kind: "observed", evidence: [] } }];
  const srv = await serveDir(templateDir(currentTemplate()));
  try {
    const page = await browser.newPage({ deviceScaleFactor: 1 });
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (r) => r.abort());
    await page.addInitScript((r) => ((window as unknown as { __REPORT__: unknown }).__REPORT__ = r), doc);
    await page.goto(`${srv.url}/report.html`);
    const slide = page.locator("#dc-root section").first();
    await slide.waitFor({ timeout: 30_000 });
    let cred = "";
    for (let i = 0; i < 14 && !cred; i++) {
      await page.waitForTimeout(120);
      const t = await slide.innerText();
      if (t.includes("CREDIBLE & CORROBORATED")) cred = t;
      else await page.keyboard.press("ArrowRight");
    }
    expect(errors).toEqual([]);
    expect(cred).toContain("What customers say");
    expect(cred).toContain("Ana R.");
    expect(cred).toContain("Great cars and service.");
    expect(cred).toContain("Read on Google");
    expect(cred).toContain("Source: Google Maps");
    await expect(slide.getByRole("link", { name: "Ana R." })).toHaveAttribute("href", "https://www.google.com/maps/contrib/1");
  } finally {
    await srv.close();
  }
});

test("the template contains no business data", () => {
  const html = currentTemplate();
  for (const word of ["Brownstone", "Brooklyn", "NYSDOT", "walk-up", "piano", "MVP", "Miami", "29 Oct 2026", "11 Nov 2026"]) {
    expect(html.includes(word), `template mentions "${word}"`).toBe(false);
  }
  // React and Babel come from the vendored copies, never from unpkg.
  expect(html).toContain('"./vendor/react.production.min.js"');
  expect(fs.existsSync(`${__dirname}/../../design/reports/vendor/react.production.min.js`)).toBe(true);
});

// ---------------------------------------------------------------------------------------------------------------
// Sources slide: websites summary (acceptance example from the owner, 16 Nov 2026)
// ---------------------------------------------------------------------------------------------------------------

type Env<T> = { v: T; p: unknown };
type Ans = { status: string; citations: string[]; citationUrls?: { page: string; url: string }[] };
type Doc = { promptAnalysis: { pages: Env<{ key: string; url: string; category: string; site?: string }>[]; questions: { question: Env<{ id: string }>; answers: Env<Ans>[] }[] } };

/** MVP Miami with mphclub.com's /miami, /exotic-car-rental and /contacts added to its existing home page: one website, four pages. */
function mphDoc(): { doc: Doc; mph: Set<string>; threePageAnswer: string } {
  const doc = fixture("mvp-miami") as Doc;
  const pa = doc.promptAnalysis;
  const ev = pa.pages[0]!.p;
  const home = pa.pages.find((p) => p.v.url === "mphclub.com")!;
  home.v.site = "mphclub.com";
  for (const [key, path] of [["oc90", "miami"], ["oc91", "exotic-car-rental"], ["oc92", "contacts"]] as const) {
    pa.pages.push({ v: { key, url: `mphclub.com/${path}`, category: "other", site: "mphclub.com" }, p: ev });
  }
  // One ChatGPT answer that already cites the home page also cites /miami and /exotic-car-rental (three mphclub pages);
  // a Gemini answer that cites no mphclub page cites /contacts.
  const all = pa.questions.flatMap((q) => q.answers.map((a, i) => ({ q, a: a.v, i })));
  const three = all.find((x) => x.i === 0 && x.a.status === "ok" && x.a.citations.includes(home.v.key))!;
  three.a.citations.push("oc90", "oc91");
  three.a.citationUrls = three.a.citations.map((page) => ({ page, url: `https://${pa.pages.find((p) => p.v.key === page)!.v.url}/?utm_source=openai` }));
  const other = all.find((x) => x.i === 2 && x.a.status === "ok" && !x.a.citations.includes(home.v.key))!;
  other.a.citations.push("oc92");
  return { doc, mph: new Set([home.v.key, "oc90", "oc91", "oc92"]), threePageAnswer: `${three.q.question.v.id} · ChatGPT` };
}

/** Answers citing any page of the website, from the answer ids (never by adding up page totals). */
function citingAnswers(doc: Doc, pages: Set<string>, engine?: number) {
  return doc.promptAnalysis.questions.flatMap((q) => q.answers.map((a, i) => ({ a: a.v, i }))).filter((x) => (engine === undefined || x.i === engine) && x.a.status === "ok" && x.a.citations.some((c) => pages.has(c))).length;
}

async function openSources(page: import("@playwright/test").Page, url: string, doc: unknown) {
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (r) => r.abort());
  await page.addInitScript((r) => ((window as unknown as { __REPORT__: unknown }).__REPORT__ = r), doc);
  await page.goto(url);
  await page.locator("#dc-root section").first().waitFor({ timeout: 30_000 });
  for (let i = 0; i < 15; i++) await page.keyboard.press("ArrowRight");
  const sec = page.locator("#s-sources");
  await sec.waitFor();
  return sec;
}

test("sources: one row per website, counted once per answer, following the provider tabs", async ({ browser }) => {
  const { doc, mph, threePageAnswer } = mphDoc();
  const srv = await serveDir(templateDir(currentTemplate()));
  try {
    const page = await browser.newPage({ deviceScaleFactor: 1 });
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    const sec = await openSources(page, `${srv.url}/report.html`, doc);
    const usable = (engine?: number) => doc.promptAnalysis.questions.flatMap((q) => q.answers.map((a, i) => ({ a: a.v, i }))).filter((x) => (engine === undefined || x.i === engine) && x.a.status === "ok").length;
    const summaryRow = (site: string) => sec.locator('button[aria-expanded]').filter({ has: page.locator("span", { hasText: new RegExp(`^${site.replace(/\./g, "\\.")}$`) }) }).last();

    // All AIs: four pages, answer count from answer ids; the three-page answer counts once.
    const want = citingAnswers(doc, mph);
    const perPage = [...mph].reduce((t, k) => t + citingAnswers(doc, new Set([k])), 0);
    expect(perPage).toBeGreaterThan(want);
    const row = summaryRow("mphclub.com");
    await expect(row).toContainText(`${want} of ${usable()}`);
    await expect(row.locator("span").last()).toHaveText("4");
    await row.click();
    const detail = row.locator("xpath=..");
    for (const p of ["mphclub.com/miami", "mphclub.com/exotic-car-rental", "mphclub.com/contacts"]) await expect(detail.getByRole("link", { name: p, exact: true })).toBeVisible();
    await expect(detail).toContainText(threePageAnswer);

    // ChatGPT tab: tiles, the group drilldown and the websites summary all switch to ChatGPT's answers.
    await sec.getByRole("tab", { name: "ChatGPT" }).click();
    await expect(sec).toContainText(`Share of ${usable(0)} usable answers`);
    await expect(sec).toContainText("Websites cited · ChatGPT");
    await expect(summaryRow("mphclub.com")).toContainText(`${citingAnswers(doc, mph, 0)} of ${usable(0)}`);
    await sec.locator("button[aria-expanded]", { hasText: "Company websites · Other businesses" }).first().click();
    await expect(sec).toContainText("Websites and pages in this group · ChatGPT");
    await expect(sec.locator('button[aria-expanded]', { hasText: "mphclub.com" }).first()).toContainText(`${citingAnswers(doc, mph, 0)} of ${usable(0)}`);

    // The answer link opens that answer, which shows the original citation URLs.
    // Back on All AIs the row is still open (expansion is kept across tabs).
    await sec.getByRole("tab", { name: "All AIs" }).click();
    await sec.getByRole("button", { name: threePageAnswer }).first().click({ timeout: 10_000 });
    await expect(page.locator("#s-prompts")).toContainText("https://mphclub.com/miami/?utm_source=openai");
    expect(errors).toEqual([]);
  } finally {
    await srv.close();
  }
});

test("sources: a report without answer-level citation links says the website answer count is unavailable", async ({ browser }) => {
  const doc = fixture("mvp-miami") as Doc;
  for (const q of doc.promptAnalysis.questions) for (const a of q.answers) if (a.v.status === "ok") a.v.citations = [];
  const srv = await serveDir(templateDir(currentTemplate()));
  try {
    const page = await browser.newPage({ deviceScaleFactor: 1 });
    const sec = await openSources(page, `${srv.url}/report.html`, doc);
    await expect(sec).toContainText("doesn’t link them to individual answers, so the number of answers citing each website is unavailable");
  } finally {
    await srv.close();
  }
});
