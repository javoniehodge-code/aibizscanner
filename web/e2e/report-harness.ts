import { execSync } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import type { AddressInfo } from "node:net";
import type { Page } from "@playwright/test";

export const ROOT = path.resolve(__dirname, "../..");
/** The last commit with the original, hand-filled Brownstone template (before the JSON refactor). */
export const LEGACY_COMMIT = "879241a";
export const SLIDE_COUNT = 24;

/** A static server for a directory holding a template, support.js and vendor/. Closes with the returned function. */
export async function serveDir(dir: string): Promise<{ url: string; close: () => Promise<void> }> {
  const server = http.createServer((req, res) => {
    const rel = decodeURIComponent(new URL(req.url ?? "/", "http://x").pathname);
    const file = path.join(dir, path.normalize(rel));
    if (!file.startsWith(dir) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404);
      res.end();
      return;
    }
    res.writeHead(200, { "content-type": file.endsWith(".js") ? "text/javascript" : "text/html; charset=utf-8" });
    fs.createReadStream(file).pipe(res);
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const { port } = server.address() as AddressInfo;
  return { url: `http://127.0.0.1:${port}`, close: () => new Promise((r) => server.close(() => r())) };
}

/** A temp dir with the template runtime (support.js + vendored React/Babel) and the given template. */
export function templateDir(templateHtml: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "report-tpl-"));
  const design = path.join(ROOT, "design/reports");
  fs.writeFileSync(path.join(dir, "report.html"), templateHtml);
  fs.copyFileSync(path.join(design, "support.js"), path.join(dir, "support.js"));
  fs.cpSync(path.join(design, "vendor"), path.join(dir, "vendor"), { recursive: true });
  return dir;
}

export function currentTemplate(): string {
  return fs.readFileSync(path.join(ROOT, "design/reports/full-business-diagnostic.dc.html"), "utf8");
}

/** The original template, which loads React from unpkg; mapped to the same vendored files so both render identically. */
export function legacyTemplate(): string {
  const html = execSync(`git show ${LEGACY_COMMIT}:design/reports/full-business-diagnostic.dc.html`, { cwd: ROOT, maxBuffer: 1e8 }).toString();
  const map = `<script>window.__resources = {
  "https://unpkg.com/react@18.3.1/umd/react.production.min.js": "./vendor/react.production.min.js",
  "https://unpkg.com/react-dom@18.3.1/umd/react-dom.production.min.js": "./vendor/react-dom.production.min.js",
  "https://unpkg.com/@babel/standalone@7.29.0/babel.min.js": "./vendor/babel.min.js"
};</script>\n`;
  return html.replace('<script src="./support.js"></script>', map + '<script src="./support.js"></script>');
}

export function fixture(id: string): unknown {
  return JSON.parse(fs.readFileSync(path.join(ROOT, "fixtures", `${id}.json`), "utf8"));
}

export type Slide = { text: string; png: Buffer };

/**
 * Opens a template and captures every slide (visible text + full-page screenshot). External requests (web fonts)
 * are blocked so renders are deterministic and nothing leaves the machine.
 */
export async function captureSlides(page: Page, url: string, report?: unknown): Promise<{ slides: Slide[]; errors: string[] }> {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (r) => r.abort());
  if (report !== undefined) await page.addInitScript((r) => ((window as unknown as { __REPORT__: unknown }).__REPORT__ = r), report);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(url);
  await page.locator("#dc-root section").first().waitFor({ timeout: 30_000 });
  await page.addStyleTag({ content: "*{transition:none!important;animation:none!important;scroll-behavior:auto!important}" });
  const slides: Slide[] = [];
  for (let i = 0; i < SLIDE_COUNT; i++) {
    await page.waitForTimeout(120);
    slides.push({ text: await page.locator("#dc-root").innerText(), png: await page.screenshot({ fullPage: true }) });
    await page.keyboard.press("ArrowRight");
  }
  return { slides, errors };
}

/** Pixel comparison in the browser (no image dependencies). Returns the share of differing pixels, or 1 on size mismatch. */
export async function diffRatio(page: Page, a: Buffer, b: Buffer): Promise<number> {
  return page.evaluate(
    async ([A, B]: [string, string]) => {
      const load = (s: string) =>
        new Promise<HTMLImageElement>((res) => {
          const i = new Image();
          i.onload = () => res(i);
          i.src = "data:image/png;base64," + s;
        });
      const [ia, ib] = await Promise.all([load(A), load(B)]);
      if (ia.width !== ib.width || ia.height !== ib.height) return 1;
      const c = document.createElement("canvas");
      c.width = ia.width;
      c.height = ia.height;
      const x = c.getContext("2d")!;
      x.drawImage(ia, 0, 0);
      const da = x.getImageData(0, 0, c.width, c.height).data;
      x.clearRect(0, 0, c.width, c.height);
      x.drawImage(ib, 0, 0);
      const db = x.getImageData(0, 0, c.width, c.height).data;
      let n = 0;
      for (let i = 0; i < da.length; i += 4) if (da[i] !== db[i] || da[i + 1] !== db[i + 1] || da[i + 2] !== db[i + 2]) n++;
      return n / (da.length / 4);
    },
    [a.toString("base64"), b.toString("base64")] as [string, string],
  );
}
