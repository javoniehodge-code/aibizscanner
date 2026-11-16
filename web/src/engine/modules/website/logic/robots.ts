import robotsParser from "robots-parser";

/**
 * AI crawler tokens per engine, from the providers' published crawler documentation (registry version below).
 * "search" decides whether the engine's search can list a page; "user" is fetching on a user's request; "training"
 * only affects model training; Google-Extended is a control token, not a crawler. Recheck the sources when updating:
 * OpenAI developers.openai.com/api/docs/bots, Anthropic support "Does Anthropic crawl data from the web",
 * Google developers.google.com/search/docs/crawling-indexing/google-common-crawlers.
 */
export const ROBOTS_REGISTRY_VERSION = "2026-11-17";
export const CRAWLERS = [
  { engine: 0, token: "OAI-SearchBot", purpose: "search" },
  { engine: 0, token: "ChatGPT-User", purpose: "user" },
  { engine: 0, token: "GPTBot", purpose: "training" },
  { engine: 1, token: "Claude-SearchBot", purpose: "search" },
  { engine: 1, token: "Claude-User", purpose: "user" },
  { engine: 1, token: "ClaudeBot", purpose: "training" },
  { engine: 2, token: "Googlebot", purpose: "search" },
  { engine: 2, token: "Google-Extended", purpose: "control" },
] as const;
export type CrawlerToken = (typeof CRAWLERS)[number]["token"];

export type RobotsFile = { url: string; status: number | null; body: string | null; error: string | null };
export type Permission = { verdict: "allowed" | "blocked" | "unconfirmed"; line: number | null; reason: string };

/**
 * Published permission for one crawler token on one URL. A robots.txt that is missing (404/410 and other 4xx except
 * 401/403/429) means no restrictions. A 401/403, 429, 5xx or failed fetch is "unconfirmed": it is never read as a
 * disallow (website-discovery-accessibility.md §4). This is the published rule only, not proof of what the crawler sees.
 */
export function permission(robots: RobotsFile, url: string, token: string): Permission {
  const s = robots.status;
  if (s === null) return { verdict: "unconfirmed", line: null, reason: `robots.txt could not be fetched (${robots.error ?? "no response"})` };
  if (s === 401 || s === 403) return { verdict: "unconfirmed", line: null, reason: `robots.txt returned ${s}; not read as a block` };
  if (s === 429 || s >= 500) return { verdict: "unconfirmed", line: null, reason: `robots.txt returned ${s}` };
  if (s >= 400) return { verdict: "allowed", line: null, reason: `No robots.txt (HTTP ${s}), so no published restrictions` };
  const parser = robotsParser(robots.url, robots.body ?? "");
  const allowed = parser.isAllowed(url, token);
  const line = parser.getMatchingLineNumber(url, token);
  if (allowed === undefined) return { verdict: "unconfirmed", line: null, reason: "The URL is on a different host than this robots.txt" };
  return allowed
    ? { verdict: "allowed", line: line > 0 ? line : null, reason: line > 0 ? `Allowed by robots.txt line ${line}` : "No rule in robots.txt applies" }
    : { verdict: "blocked", line: line > 0 ? line : null, reason: `Disallowed by robots.txt line ${line}` };
}

/** Sitemap URLs advertised in robots.txt. */
export function sitemapsIn(robots: RobotsFile): string[] {
  if (!robots.body || robots.status !== 200) return [];
  return robotsParser(robots.url, robots.body).getSitemaps();
}
