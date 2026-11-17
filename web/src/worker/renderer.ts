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
 *   for text). Each page is capped at 150 requests, 10 MB in total, 4 MB per response and 45 seconds (a fresh browser per page).
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
/** Hard limit per page, launch included; the browser is killed when it is reached. */
const PAGE_DEADLINE_MS = 45_000;
const CLOSE_WAIT_MS = 5_000;
const MAX_REDIRECTS = 5;
const CRASHED = /has been closed|browser has disconnected|Target crashed|crashed/i;
const SKIPPED_TYPES = new Set(["image", "media", "font"]);
const DATA_TYPES = new Set(["xhr", "fetch", "script", "document", "eventsource"]);
/** Request headers Node's fetch sets itself or refuses. */
const DROP_REQUEST = new Set(["host", "connection", "content-length", "accept-encoding", "user-agent", "keep-alive", "upgrade", "te", "trailer", "transfer-encoding", "proxy-authorization", "proxy-connection"]);
/** Response headers that no longer describe the (already decoded) body. */
const DROP_RESPONSE = new Set(["content-encoding", "content-length", "transfer-encoding", "connection", "keep-alive"]);

type Guard = (url: string) => Promise<URL>;
export type RendererOptions = {
  /** Address check for every request (default: the protected fetcher's). Tests pass one that allows a local server. */
  guard?: Guard;
  launch?: () => Promise<Browser>;
  /** Hard limit per page (default 45 s). */
  pageDeadlineMs?: number;
};

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

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
 * A fresh browser for every page, closed when the page is done (Chromium on Vercel runs as a single process and in
 * production got stuck opening a second page in the same browser). Each page also has a hard time limit: when it is
 * reached the browser is killed and the page is recorded as not loaded, so one stuck page can't stall the run.
 */
export function headlessRenderer(options: RendererOptions = {}): PageRenderer & { close(): Promise<void> } {
  const guard = options.guard ?? ((u: string) => assertPublicUrl(u));
  const pageDeadlineMs = options.pageDeadlineMs ?? PAGE_DEADLINE_MS;
  const live = new Set<Promise<Browser>>();

  const shut = async (launching: Promise<Browser>) => {
    live.delete(launching);
    const b = await Promise.race([launching.catch(() => null), sleep(CLOSE_WAIT_MS).then(() => null)]);
    if (b) await Promise.race([b.close().catch(() => undefined), sleep(CLOSE_WAIT_MS)]);
  };

  async function withBrowser(requested: string, signal: AbortSignal): Promise<RenderedPage> {
    const started = Date.now();
    const launching = (options.launch ?? defaultLaunch)();
    launching.catch(() => undefined);
    live.add(launching);
    let timer: ReturnType<typeof setTimeout> | undefined;
    const deadline = new Promise<RenderedPage>((resolve) => {
      timer = setTimeout(
        () =>
          resolve({
            requestedUrl: requested,
            finalUrl: null,
            status: null,
            html: null,
            truncated: false,
            error: `The page didn't finish loading within ${Math.round(pageDeadlineMs / 1000)} s`,
            durationMs: Date.now() - started,
            userAgent: USER_AGENT,
            requests: { fetched: 0, refused: 0, skipped: 0, failed: 0 },
          }),
        pageDeadlineMs,
      );
    });
    try {
      return await Promise.race([renderOne(requested, signal, launching), deadline]);
    } finally {
      clearTimeout(timer);
      await shut(launching);
    }
  }

  return {
    async close() {
      await Promise.all([...live].map(shut));
    },
    async render(requested, signal) {
      const first = await withBrowser(requested, signal);
      // A crash mid-page: retry once in a new browser.
      if (!first.error || !CRASHED.test(first.error)) return first;
      const second = await withBrowser(requested, signal);
      return second.error ? { ...second, error: `${second.error} (after a browser crash and one retry)` } : second;
    },
  };

  async function renderOne(requested: string, signal: AbortSignal, launching: Promise<Browser>): Promise<RenderedPage> {
    const started = Date.now();
    const requests = { fetched: 0, refused: 0, skipped: 0, failed: 0 };
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
      const b = await launching;
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
          const isDocument = req.isNavigationRequest() && req.frame().parentFrame() === null;
          if (isDocument) documentUrl = url;
          // The page's own data (scripts, API calls) answered with an error: the copy may be missing content.
          else if (res.status >= 400 && DATA_TYPES.has(req.resourceType())) requests.failed++;
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
