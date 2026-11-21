import { sha256Hex } from "../../../json";
import type { StageContext } from "../../../types";
import { wordCount } from "../../web-presence/logic/pages";
import { OUR_ROBOTS_TOKEN } from "../../web-presence/stages";
import { extractPage } from "../../website/logic/extract";
import { permission, type RobotsFile } from "../../website/logic/robots";

/** A plain copy with fewer words than this is tried in our browser (rental fleets often load by JavaScript). */
const THIN_WORDS = 150;
const MIN_WORDS = 30;

export type ReadPage = { url: string; state: "checked" | "unchecked"; reason: string | null; snapshotId: string | null; title: string | null; words: number; mode: "plain" | "browser" | null };

/**
 * Reads one competitor page the way the cited-page check does: robots.txt for our checker first (a page it disallows
 * isn't fetched), a plain copy, then our browser when the plain copy is refused or thin and the time budget allows.
 * Every copy is stored as a page snapshot. A page we couldn't read is "unchecked", never read as information missing.
 */
export async function readPage(ctx: StageContext, url: string, robots: Map<string, Promise<RobotsFile>>, browserAllowed: () => boolean): Promise<ReadPage> {
  const origin = new URL(url).origin;
  if (!robots.has(origin)) {
    const robotsUrl = `${origin}/robots.txt`;
    robots.set(origin, ctx.fetchUrl(robotsUrl, { accept: "text", maxBytes: 500_000 }).then((r) => ({ url: robotsUrl, status: r.status, body: r.body, error: r.error })));
  }
  const rule = permission(await robots.get(origin)!, url, OUR_ROBOTS_TOKEN);
  if (rule.verdict === "blocked") return { url, state: "unchecked", reason: `The site's robots.txt asks checkers like ours not to fetch this page (${rule.reason.toLowerCase()}).`, snapshotId: null, title: null, words: 0, mode: null };

  const store = async (mode: "raw" | "rendered", r: { finalUrl: string | null; userAgent: string; status: number | null; body: string | null; error: string | null }) => {
    const ex = r.body && !r.error ? extractPage(r.body, { wholeBody: true }) : null;
    const id = await ctx.recordPageSnapshot({
      url,
      finalUrl: r.finalUrl,
      fetchMode: mode,
      userAgent: r.userAgent,
      httpStatus: r.status,
      contentHash: r.body ? await sha256Hex(r.body) : null,
      textHash: ex ? await sha256Hex(ex.text) : null,
      html: r.body,
      text: ex?.text ?? null,
      error: r.error,
      fetchedAt: new Date().toISOString(),
    });
    return { id, ex, words: ex ? wordCount(ex.text) : 0, error: r.error ?? (ex ? null : `HTTP ${r.status}`) };
  };

  const plain = await store("raw", await ctx.fetchUrl(url, { accept: "html" }));
  if (plain.words >= THIN_WORDS) return { url, state: "checked", reason: null, snapshotId: plain.id, title: plain.ex!.title, words: plain.words, mode: "plain" };
  let browser: Awaited<ReturnType<typeof store>> | null = null;
  let browserError: string | null = null;
  if (browserAllowed()) {
    try {
      const r = await ctx.renderUrl(url);
      browser = await store("rendered", { finalUrl: r.finalUrl, userAgent: r.userAgent, status: r.status, body: r.html, error: r.error });
    } catch (e) {
      if (ctx.signal.aborted) throw e;
      browserError = e instanceof Error ? e.message : String(e);
    }
  } else browserError = "this run ran out of time before our browser reached it";
  const best = [browser, plain].filter((x) => x && x.words >= MIN_WORDS).sort((a, b) => b!.words - a!.words)[0];
  if (best) return { url, state: "checked", reason: null, snapshotId: best.id, title: best.ex?.title ?? null, words: best.words, mode: best === plain ? "plain" : "browser" };
  const why = [plain.error ? `our plain fetch failed (${plain.error})` : `our plain copy had only ${plain.words} words`, browser ? (browser.error ? `our browser: ${browser.error}` : `our browser copy had only ${browser.words} words`) : browserError ? `our browser: ${browserError}` : null].filter(Boolean).join("; ");
  return { url, state: "unchecked", reason: `We couldn't read this page: ${why}.`, snapshotId: null, title: null, words: 0, mode: null };
}
