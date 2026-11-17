import "server-only";
import type { Browser, BrowserContext, Route } from "playwright-core";
import type { PageRenderer, RenderedPage } from "@/engine";
import { USER_AGENT } from "./fetcher";
import { assertPublicUrl } from "./url-guard";

/**
 * Our headless browser for the JavaScript check (report-tech-requirements.md §3.2): loads a page so its scripts run,
 * then returns the resulting HTML. A diagnostic of ours, never an AI's view of the page.
 *
 * Safety, the same rules as the protected fetcher:
 * - Chromium itself never touches the network. Every request the page makes is intercepted and fetched by us, one hop
 *   at a time: public http(s) on ports 80/443 only, every host checked against private, internal and cloud-metadata
 *   addresses at every redirect hop (we follow redirects ourselves, at most 5). Chromium's own network is pointed at a
 *   dead proxy, so anything that escaped interception would fail rather than go out.
 * - WebSockets are closed, service workers blocked, downloads refused. Images, media and fonts are skipped (not needed
 *   for text). Each page is capped at 150 requests, 10 MB in total, 4 MB per response and about 30 seconds.
 * - An honest user agent: Chromium's own, with AIBizScannerBot appended. No logins, no challenge solving, no retries.
 *
 * Chromium comes from @sparticuz/chromium on Vercel; elsewhere set CHROMIUM_PATH (or have a Playwright browser installed).
 */
const MAX_REQUESTS = 150;
const MAX_TOTAL_BYTES = 10_000_000;
const MAX_RESPONSE_BYTES = 4_000_000;
const MAX_HTML_CHARS = 2_000_000;
const NAV_TIMEOUT_MS = 20_000;
const SETTLE_MS = 6_000;
const REQUEST_TIMEOUT_MS = 15_000;
const IDLE_CLOSE_MS = 5_000;
const MAX_REDIRECTS = 5;
const CRASHED = /has been closed|browser has disconnected|Target crashed|crashed/i;
const SKIPPED_TYPES = new Set(["image", "media", "font"]);
/** Request headers Node's fetch sets itself or refuses. */
const DROP_REQUEST = new Set(["host", "connection", "content-length", "accept-encoding", "user-agent", "keep-alive", "upgrade", "te", "trailer", "transfer-encoding", "proxy-authorization", "proxy-connection"]);
/** Response headers that no longer describe the (already decoded) body. */
const DROP_RESPONSE = new Set(["content-encoding", "content-length", "transfer-encoding", "connection", "keep-alive"]);

type Guard = (url: string) => Promise<URL>;
export type RendererOptions = {
  /** Address check for every request (default: the protected fetcher's). Tests pass one that allows a local server. */
  guard?: Guard;
  launch?: () => Promise<Browser>;
};

async function defaultLaunch(): Promise<Browser> {
  const { chromium } = await import("playwright-core");
  // A dead proxy: requests are all fulfilled by our route handler; anything that bypassed it fails instead of going out.
  const lockdown = ["--proxy-server=http://127.0.0.1:9", "--proxy-bypass-list=<-loopback>", "--dns-prefetch-disable", "--disable-background-networking", "--no-pings"];
  if (process.env.CHROMIUM_PATH) return chromium.launch({ executablePath: process.env.CHROMIUM_PATH, args: lockdown });
  if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
    const sparticuz = (await import("@sparticuz/chromium")).default;
    return chromium.launch({ executablePath: await sparticuz.executablePath(), args: [...sparticuz.args, ...lockdown], headless: true });
  }
  return chromium.launch({ args: lockdown });
}

const postBody = (b: Buffer | null) => (b ? new Uint8Array(b) : undefined);

async function readCapped(res: Response, max: number): Promise<{ body: Buffer; truncated: boolean }> {
  if (!res.body) return { body: Buffer.alloc(0), truncated: false };
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) return { body: Buffer.concat(chunks), truncated: false };
    if (size + value.byteLength > max) {
      chunks.push(value.subarray(0, max - size));
      await reader.cancel();
      return { body: Buffer.concat(chunks), truncated: true };
    }
    chunks.push(value);
    size += value.byteLength;
  }
}

/**
 * One browser shared by the pages being loaded, opened on first use and closed a few seconds after the last page
 * finishes; each page gets a fresh context (no shared cookies or storage).
 */
export function headlessRenderer(options: RendererOptions = {}): PageRenderer & { close(): Promise<void> } {
  const guard = options.guard ?? ((u: string) => assertPublicUrl(u));
  let browser: Promise<Browser> | null = null;
  let active = 0;
  let idle: ReturnType<typeof setTimeout> | null = null;
  const close = async () => {
    const b = browser;
    browser = null;
    if (b) await (await b.catch(() => null))?.close().catch(() => undefined);
  };
  const open = () => {
    if (idle) clearTimeout(idle);
    idle = null;
    if (!browser) {
      const launching = (options.launch ?? defaultLaunch)();
      // A failed launch, or a browser that crashed or closed, isn't kept: the next page starts a new one.
      launching.then(
        (b) => b.on("disconnected", () => {
          if (browser === launching) browser = null;
        }),
        () => {
          if (browser === launching) browser = null;
        },
      );
      browser = launching;
    }
    return browser;
  };
  const release = () => {
    if (--active === 0) idle = setTimeout(() => void close(), IDLE_CLOSE_MS);
  };

  return {
    close,
    async render(requested, signal) {
      active++;
      try {
        const first = await renderOne(requested, signal);
        // Chromium on Vercel runs as a single process, and can crash mid-page: retry once in a new browser.
        if (!first.error || !CRASHED.test(first.error)) return first;
        await close();
        const second = await renderOne(requested, signal);
        return second.error ? { ...second, error: `${second.error} (after a browser crash and one retry)` } : second;
      } finally {
        release();
      }
    },
  };

  async function renderOne(requested: string, signal: AbortSignal): Promise<RenderedPage> {
    const started = Date.now();
    const requests = { fetched: 0, refused: 0, skipped: 0 };
    let userAgent = USER_AGENT;
    let totalBytes = 0;
    const out = (p: Partial<RenderedPage>): RenderedPage => ({ requestedUrl: requested, finalUrl: null, status: null, html: null, truncated: false, error: null, durationMs: Date.now() - started, userAgent, requests, ...p });

    try {
      await guard(requested);
    } catch (e) {
      return out({ error: `Refused: ${e instanceof Error ? e.message : String(e)}` });
    }

    let context: BrowserContext | null = null;
    try {
      const b = await open();
      userAgent = `Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/${b.version()} Safari/537.36 AIBizScannerBot/0.1 (internal report testing)`;
      context = await b.newContext({ userAgent, serviceWorkers: "block", acceptDownloads: false, javaScriptEnabled: true, locale: "en-US", viewport: { width: 1280, height: 900 } });
      await context.routeWebSocket(/.*/, (ws) => ws.close({ code: 1008, reason: "WebSockets are not used by the JavaScript check" }));
      const pending = new Set<AbortController>();
      const onAbort = () => pending.forEach((c) => c.abort());
      signal.addEventListener("abort", onAbort);

      // The main document's last address after redirects (our handler follows them; see below).
      let documentUrl: string | null = null;
      await context.route("**/*", async (route: Route) => {
        const req = route.request();
        if (SKIPPED_TYPES.has(req.resourceType()) || requests.fetched + requests.refused >= MAX_REQUESTS || totalBytes >= MAX_TOTAL_BYTES) {
          requests.skipped++;
          return route.abort("blockedbyclient").catch(() => undefined);
        }
        const ctrl = new AbortController();
        pending.add(ctrl);
        try {
          const headers = Object.fromEntries(Object.entries(await req.allHeaders()).filter(([k]) => !DROP_REQUEST.has(k.toLowerCase()) && !k.startsWith(":")));
          // Chromium follows a redirect we hand back without asking us again, so we follow redirects here, checking
          // every hop's address, and give the browser only the final response.
          let url = req.url();
          let method = req.method();
          let res: Response | null = null;
          for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
            try {
              await guard(url);
            } catch {
              requests.refused++;
              return await route.abort("blockedbyclient").catch(() => undefined);
            }
            requests.fetched++;
            res = await fetch(url, {
              method,
              headers: { ...headers, "user-agent": userAgent },
              body: method === "GET" || method === "HEAD" ? undefined : postBody(req.postDataBuffer()),
              redirect: "manual",
              signal: AbortSignal.any([ctrl.signal, AbortSignal.timeout(REQUEST_TIMEOUT_MS)]),
            });
            const location = res.status >= 300 && res.status < 400 ? res.headers.get("location") : null;
            if (!location) break;
            await res.body?.cancel();
            res = null;
            url = new URL(location, url).toString();
            if (method !== "HEAD") method = "GET";
          }
          if (!res) return await route.abort("failed").catch(() => undefined);
          if (req.isNavigationRequest() && req.frame().parentFrame() === null) documentUrl = url;
          const { body } = await readCapped(res, Math.min(MAX_RESPONSE_BYTES, MAX_TOTAL_BYTES - totalBytes));
          totalBytes += body.byteLength;
          const resHeaders: Record<string, string> = {};
          res.headers.forEach((v, k) => {
            if (!DROP_RESPONSE.has(k) && k !== "set-cookie") resHeaders[k] = v;
          });
          const setCookies = res.headers.getSetCookie();
          if (setCookies.length) resHeaders["set-cookie"] = setCookies.join("\n");
          await route.fulfill({ status: res.status, headers: resHeaders, body });
        } catch {
          await route.abort("failed").catch(() => undefined);
        } finally {
          pending.delete(ctrl);
        }
      });

      const page = await context.newPage();
      page.setDefaultTimeout(NAV_TIMEOUT_MS);
      const onPopup = (p: { close(): Promise<void> }) => void p.close().catch(() => undefined);
      context.on("page", (p) => p !== page && onPopup(p));
      try {
        let response = await page.goto(requested, { waitUntil: "domcontentloaded", timeout: NAV_TIMEOUT_MS });
        if (signal.aborted) throw signal.reason;
        // The page was redirected: load the final address so relative links and scripts resolve against it.
        const landed = documentUrl as string | null;
        if (landed && landed !== requested) response = await page.goto(landed, { waitUntil: "domcontentloaded", timeout: NAV_TIMEOUT_MS });
        if (signal.aborted) throw signal.reason;
        // Let scripts fetch and draw their content, scroll once for lazy sections, then settle again.
        await page.waitForLoadState("networkidle", { timeout: SETTLE_MS }).catch(() => undefined);
        await page.evaluate(() => window.scrollTo(0, document.body?.scrollHeight ?? 0)).catch(() => undefined);
        await page.waitForLoadState("networkidle", { timeout: SETTLE_MS / 2 }).catch(() => undefined);
        const html = await page.evaluate(() => "<!DOCTYPE html>\n" + document.documentElement.outerHTML);
        const status = response?.status() ?? null;
        return out({
          finalUrl: page.url(),
          status,
          html: html.slice(0, MAX_HTML_CHARS),
          truncated: html.length > MAX_HTML_CHARS,
          error: status !== null && status >= 400 ? `HTTP ${status}` : null,
        });
      } finally {
        signal.removeEventListener("abort", onAbort);
      }
    } catch (e) {
      if (signal.aborted) throw e;
      const m = e instanceof Error ? e.message.split("\n")[0]! : String(e);
      return out({ error: /Timeout/i.test(m) ? `The page didn't load within ${NAV_TIMEOUT_MS / 1000} s` : `The browser couldn't load the page: ${m}` });
    } finally {
      await context?.close().catch(() => undefined);
    }
  }
}
