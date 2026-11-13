import { expect, test } from "@playwright/test";
import fs from "node:fs";
import { captureSlides, currentTemplate, diffRatio, fixture, legacyTemplate, serveDir, SLIDE_COUNT, templateDir } from "./report-harness";

// These tests render the design template directly (no app, no database).
test.describe.configure({ mode: "serial" });
test.setTimeout(240_000);

test("Brownstone: every slide matches the original hand-filled template", async ({ browser }) => {
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
