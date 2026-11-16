import "server-only";
import type { FetchedResource, FetchOptions, WebFetcher } from "@/engine";
import { assertPublicUrl, RefusedUrlError } from "./url-guard";

/**
 * Our protected fetcher for business websites (brief §4, website-discovery-accessibility.md §10):
 * - public http(s) on ports 80/443 only; every hop's host must resolve only to public unicast addresses, so private,
 *   loopback, link-local and cloud-metadata addresses are refused, redirects included (at most 5);
 * - size, time and content-type caps; bodies over the cap are cut and marked truncated;
 * - an honest user agent. It never retries a refusal, solves a challenge or logs in: a 403 or challenge page is recorded
 *   as it is. Sending a crawler's user agent would prove nothing about what that crawler sees, so we never do.
 */
export const USER_AGENT = "Mozilla/5.0 (compatible; AIBizScannerBot/0.1; internal report testing)";
const MAX_REDIRECTS = 5;
const TIMEOUT_MS = 15_000;
const DEFAULT_MAX_BYTES = 2_000_000;

const TYPES: Record<FetchOptions["accept"], RegExp> = {
  html: /^(text\/html|application\/xhtml\+xml)\b/i,
  xml: /^(application\/xml|text\/xml|application\/rss\+xml|application\/atom\+xml)\b/i,
  text: /^text\/plain\b/i,
};
const ACCEPT_HEADER: Record<FetchOptions["accept"], string> = {
  html: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.1",
  xml: "application/xml,text/xml;q=0.9,*/*;q=0.1",
  text: "text/plain,*/*;q=0.1",
};

async function readCapped(res: Response, maxBytes: number): Promise<{ body: string; truncated: boolean }> {
  if (!res.body) return { body: "", truncated: false };
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  let truncated = false;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (size + value.byteLength > maxBytes) {
      chunks.push(value.subarray(0, maxBytes - size));
      size = maxBytes;
      truncated = true;
      await reader.cancel();
      break;
    }
    chunks.push(value);
    size += value.byteLength;
  }
  const charset = /charset=([\w-]+)/i.exec(res.headers.get("content-type") ?? "")?.[1] ?? "utf-8";
  let decoder: TextDecoder;
  try {
    decoder = new TextDecoder(charset);
  } catch {
    decoder = new TextDecoder("utf-8");
  }
  const all = new Uint8Array(size);
  let at = 0;
  for (const c of chunks) {
    all.set(c, at);
    at += c.byteLength;
  }
  return { body: decoder.decode(all), truncated };
}

export function protectedFetcher(): WebFetcher {
  return {
    async fetch(requested: string, opts: FetchOptions, signal: AbortSignal): Promise<FetchedResource> {
      const started = Date.now();
      const redirects: string[] = [];
      const out = (partial: Partial<FetchedResource>): FetchedResource => ({
        requestedUrl: requested,
        finalUrl: null,
        status: null,
        contentType: null,
        body: null,
        truncated: false,
        redirects,
        error: null,
        durationMs: Date.now() - started,
        userAgent: USER_AGENT,
        ...partial,
      });
      let current = requested;
      try {
        for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
          const url = await assertPublicUrl(current);
          const res = await fetch(url, {
            redirect: "manual",
            headers: { "user-agent": USER_AGENT, accept: ACCEPT_HEADER[opts.accept], "accept-language": "en-US,en;q=0.8" },
            signal: AbortSignal.any([signal, AbortSignal.timeout(TIMEOUT_MS)]),
          });
          if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
            await res.body?.cancel();
            const next = new URL(res.headers.get("location")!, url).toString();
            redirects.push(next);
            current = next;
            continue;
          }
          const contentType = res.headers.get("content-type");
          if (!res.ok) {
            await res.body?.cancel();
            return out({ finalUrl: current, status: res.status, contentType, error: `HTTP ${res.status}` });
          }
          if (contentType && !TYPES[opts.accept].test(contentType)) {
            await res.body?.cancel();
            return out({ finalUrl: current, status: res.status, contentType, error: `Unexpected content type: ${contentType}` });
          }
          const { body, truncated } = await readCapped(res, opts.maxBytes ?? DEFAULT_MAX_BYTES);
          return out({ finalUrl: current, status: res.status, contentType, body, truncated });
        }
        return out({ finalUrl: current, error: `More than ${MAX_REDIRECTS} redirects` });
      } catch (e) {
        if (signal.aborted) throw e;
        const message = e instanceof RefusedUrlError ? `Refused: ${e.message}` : e instanceof Error ? (e.name === "TimeoutError" ? `Timed out after ${TIMEOUT_MS / 1000} s` : e.message) : String(e);
        return out({ finalUrl: current, error: message });
      }
    },
  };
}
