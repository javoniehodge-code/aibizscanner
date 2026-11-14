import { expect, test } from "@playwright/test";
import fs from "node:fs";
import { captureSlides, currentTemplate, diffRatio, fixture, legacyTemplate, serveDir, SLIDE_COUNT, templateDir } from "./report-harness";

// These tests render the design template directly (no app, no database).
test.describe.configure({ mode: "serial" });
test.setTimeout(240_000);

/** Slide indexes changed on purpose since the original: 5 Businesses named (top 15, no first-choice chart, slanted names; 14 Nov 2026). */
const REDESIGNED = new Set([5]);

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

test("the template contains no business data", () => {
  const html = currentTemplate();
  for (const word of ["Brownstone", "Brooklyn", "NYSDOT", "walk-up", "piano", "MVP", "Miami", "29 Oct 2026", "11 Nov 2026"]) {
    expect(html.includes(word), `template mentions "${word}"`).toBe(false);
  }
  // React and Babel come from the vendored copies, never from unpkg.
  expect(html).toContain('"./vendor/react.production.min.js"');
  expect(fs.existsSync(`${__dirname}/../../design/reports/vendor/react.production.min.js`)).toBe(true);
});
