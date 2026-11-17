import { existsSync } from "node:fs";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const { headlessRenderer } = await import("./renderer");
const { assertPublicUrl } = await import("./url-guard");

/**
 * Loads pages from a local server in a real headless Chromium. Runs where a browser is available (CHROMIUM_PATH, or
 * the preinstalled /opt/pw-browsers/chromium); skipped otherwise (the unit-test CI job has no browser).
 */
const chromiumPath = process.env.CHROMIUM_PATH ?? (existsSync("/opt/pw-browsers/chromium") ? "/opt/pw-browsers/chromium" : null);
if (chromiumPath) process.env.CHROMIUM_PATH = chromiumPath;

const hits: string[] = [];
let server: Server;
let base = "";

const PAGE = `<!doctype html><html><head><title>Rentals</title></head><body><main>
<h1>Our fleet</h1><p>Vehicles Found: <span id="n"></span></p><ul id="list"></ul>
<script>
fetch("/data.json").then(r => r.json()).then(d => {
  document.getElementById("n").textContent = d.length;
  for (const v of d) { const li = document.createElement("li"); li.textContent = v.name + " from $" + v.price + " per day"; document.getElementById("list").appendChild(li); }
});
fetch("http://169.254.169.254/latest/meta-data/").catch(() => {});
fetch("/hop").catch(() => {});
</script></main></body></html>`;

beforeAll(async () => {
  server = createServer((req, res) => {
    hits.push(req.url ?? "");
    if (req.url === "/data.json") return res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify([{ name: "Lamborghini Huracan", price: 1495 }, { name: "Rolls-Royce Cullinan", price: 1995 }]));
    if (req.url === "/hop") return res.writeHead(302, { location: "/hop2" }).end();
    if (req.url === "/hop2") return res.writeHead(302, { location: "http://10.0.0.1/secret" }).end();
    if (req.url === "/moved") return res.writeHead(301, { location: "/rentals-new" }).end();
    if (req.url === "/denied") return res.writeHead(403, { "content-type": "text/html" }).end("<html><body><main><p>Access denied</p></main></body></html>");
    res.writeHead(200, { "content-type": "text/html" }).end(PAGE);
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(() => new Promise<void>((r) => server.close(() => r())));

// Allows only our local test server (any port); everything else gets the production check.
const guard = async (u: string) => {
  const url = new URL(u);
  if (url.hostname === "127.0.0.1" && url.port === new URL(base).port) return url;
  return assertPublicUrl(u);
};

describe.skipIf(!chromiumPath)("headless renderer (the JavaScript check)", () => {
  it("returns the HTML after scripts ran, and refuses private addresses, redirects included", async () => {
    const r = headlessRenderer({ guard });
    try {
      const page = await r.render(`${base}/rentals`, new AbortController().signal);
      expect(page.error).toBeNull();
      expect(page.status).toBe(200);
      expect(page.html).toContain("Lamborghini Huracan from $1495 per day");
      expect(page.userAgent).toMatch(/HeadlessChrome\/.* AIBizScannerBot\/0\.1/);
      // metadata address and the redirect to 10.0.0.1 were refused, never fetched
      expect(page.requests.refused).toBeGreaterThanOrEqual(2);
      expect(hits).toEqual(expect.arrayContaining(["/hop", "/hop2"]));
      expect(hits.some((h) => h.includes("secret"))).toBe(false);

      const moved = await r.render(`${base}/moved`, new AbortController().signal);
      expect(moved.finalUrl).toBe(`${base}/rentals-new`);
      expect(moved.html).toContain("Rolls-Royce Cullinan from $1995 per day");

      const denied = await r.render(`${base}/denied`, new AbortController().signal);
      expect(denied.status).toBe(403);
      expect(denied.error).toBe("HTTP 403");

      const refused = await r.render("http://127.0.0.1:1/", new AbortController().signal);
      expect(refused.error).toMatch(/^Refused/);
    } finally {
      await r.close();
    }
  }, 60_000);

  it("starts a new browser when the old one crashed or closed", async () => {
    const { chromium } = await import("playwright-core");
    const launched: import("playwright-core").Browser[] = [];
    const r = headlessRenderer({ guard, launch: async () => { const b = await chromium.launch({ executablePath: chromiumPath! }); launched.push(b); return b; } });
    try {
      expect((await r.render(`${base}/rentals`, new AbortController().signal)).error).toBeNull();
      await launched[0]!.close(); // as if Chromium died between pages
      const again = await r.render(`${base}/rentals`, new AbortController().signal);
      expect(again.error).toBeNull();
      expect(again.html).toContain("Lamborghini Huracan from $1495 per day");
      expect(launched).toHaveLength(2);
    } finally {
      await r.close();
    }
  }, 60_000);
});

describe("headless renderer time limit", () => {
  it("gives up on a page that gets stuck, kills its browser, and starts a new one for the next page", async () => {
    let launches = 0;
    let closed = 0;
    // A browser that never finishes opening a page (what single-process Chromium did in production).
    const stuck = { version: () => "153.0", newContext: () => new Promise(() => {}), close: async () => void closed++ } as unknown as import("playwright-core").Browser;
    const r = headlessRenderer({ guard: async (u) => new URL(u), pageDeadlineMs: 300, launch: async () => (launches++, stuck) });
    const a = await r.render("https://example.com/a", new AbortController().signal);
    expect(a.error).toBe("The page didn't finish loading within 0 s");
    const b = await r.render("https://example.com/b", new AbortController().signal);
    expect(b.error).toMatch(/didn't finish loading/);
    expect([launches, closed]).toEqual([2, 2]);
  });
});
