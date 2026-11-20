import { z } from "zod";
import { errorMessage } from "../../errors";
import { sha256Hex } from "../../json";
import type { JsonValue, StageContext, StageDefinition } from "../../types";
import { promptSetSpec } from "../prompt-analysis/schemas";
import { assembledSection } from "../prompt-analysis/stages";
import { extractPage } from "../website/logic/extract";
import { permission, type RobotsFile } from "../website/logic/robots";
import { CITED_PAGES_VERSION, PAGE_CAP, candidatePages, namesOnPage, planNext, wordCount, type NamedBusiness, type PageStatus, type RankedPage } from "./logic/pages";
import { serviceLines, shownLines } from "../prompt-analysis/lines-stage";
import { citedPages, type CitedPages } from "./schemas";
import { wpAssess } from "./assess-stage";
import { wpSection } from "./section-stage";

export const MODULE = "web-presence";
/** Our checker's robots.txt token (the worker's user agent says AIBizScannerBot). */
export const OUR_ROBOTS_TOKEN = "AIBizScannerBot";
/** A plain copy with fewer words than this is tried again in our browser (directory and review pages often need it). */
const THIN_WORDS = 150;
/** A page with fewer words than this, in every copy we have, counts as unreadable. */
const MIN_WORDS = 30;
const PLAIN_CONCURRENCY = 4;
/** The start of the text we read, kept for review. */
const excerptOf = (text: string) => (text.length > 300 ? `${text.slice(0, 300).replace(/\s+\S*$/, "")}…` : text).replace(/\s+/g, " ").trim();
/** Browser loads start only within this budget (the stage times out at 270 s); later pages wait for a rerun. */
const BROWSER_BUDGET_MS = 200_000;

function input<T>(ctx: StageContext, stage: string, schema: z.ZodType<T>): T {
  const i = ctx.inputs[stage];
  if (!i) throw new Error(`Missing input ${stage}`);
  return schema.parse(i.output);
}

async function mapLimit<T, R>(items: readonly T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i]!);
      }
    }),
  );
  return out;
}

type Page = CitedPages["pages"][number];

/**
 * wp_pages (stage 8, collection): the cited outside pages, ranked by distinct prompts, up to PAGE_CAP of them. For each,
 * we follow the site's robots.txt for our own checker, take a plain copy, and use our browser when the plain copy is
 * refused or thin (an earlier browser copy from this report is used when there is one). Plain code then finds which
 * businesses the page names. A page we couldn't read is "unchecked", never read as the business being absent.
 * Nothing is bypassed: a site that refuses our checker stays unchecked.
 */
export const wpPages: StageDefinition = {
  id: "wp_pages",
  module: MODULE,
  label: "Web presence 1/3: check the outside pages AI cited",
  inputs: ["pa_prompt_set", "pa_assemble"],
  /** Service lines: when saved, pages are chosen per line (a new save reruns this stage). */
  optionalInputs: ["pa_lines"],
  timeoutMs: 270_000,
  maxAttempts: 2,
  autoRun: true,
  parseParams: (raw) => {
    z.object({}).strict().parse(raw ?? {});
    return {};
  },
  output: citedPages,
  async run(ctx) {
    const set = input(ctx, "pa_prompt_set", promptSetSpec);
    const pa = input(ctx, "pa_assemble", assembledSection);
    const targetKey = pa.business.key;
    const businesses: NamedBusiness[] = pa.section.businesses.map(({ v: b }) => (b.key === targetKey ? { key: b.key, name: b.name, aliases: set.target.aliases } : { key: b.key, name: b.name }));
    businesses.sort((a, b) => (a.key === targetKey ? -1 : b.key === targetKey ? 1 : 0));

    // Lines may have been saved for an earlier prompt set: only this set's questions count towards a line.
    const linesIn = ctx.inputs.pa_lines;
    const lines = linesIn ? shownLines({ lines: serviceLines.parse(linesIn.output).lines.map((l) => ({ name: l.name, questions: l.questions.filter((q) => set.prompts.some((p) => p.id === q)) })) }) : null;
    const cands = candidatePages(pa.section, businesses.filter((b) => b.key !== targetKey), lines);

    // robots.txt once per host; a missing or unreadable file is no restriction (it is never read as a block).
    const robots = new Map<string, Promise<RobotsFile>>();
    const robotsFor = (url: string) => {
      const origin = new URL(url).origin;
      if (!robots.has(origin)) {
        const robotsUrl = `${origin}/robots.txt`;
        robots.set(
          origin,
          ctx.fetchUrl(robotsUrl, { accept: "text", maxBytes: 500_000 }).then((r) => ({ url: robotsUrl, status: r.status, body: r.body, error: r.error })),
        );
      }
      return robots.get(origin)!;
    };

    const pageBase = (p: RankedPage) => ({ key: p.key, url: p.url, site: p.site, category: p.category, title: p.title, prompts: p.prompts, answers: p.answers, engines: p.engines });
    const started = Date.now();
    const texts = new Map<string, string>();
    /** Reads one batch of pages: robots.txt, a plain copy, then our browser where needed. */
    const checkBatch = async (chosen: readonly RankedPage[]): Promise<Page[]> => {
    // Step 1: robots.txt and the plain copy, a few pages at a time.
    type Draft = Omit<Page, "state" | "reason" | "source" | "names" | "excerpt"> & { blocked: string | null; plain: { snapshotId: string; text: string; title: string | null; words: number; status: number | null; finalUrl: string | null; fetchedAt: string } | null; plainError: string | null };
    const drafts = await mapLimit(chosen, PLAIN_CONCURRENCY, async (p): Promise<Draft> => {
      const base = { ...pageBase(p), attempts: [] as Page["attempts"] };
      const rule = permission(await robotsFor(p.url), p.url, OUR_ROBOTS_TOKEN);
      if (rule.verdict === "blocked") return { ...base, blocked: `The site's robots.txt asks checkers like ours not to fetch this page (${rule.reason.toLowerCase()}).`, plain: null, plainError: null };
      const res = await ctx.fetchUrl(p.url, { accept: "html" });
      const ex = res.body && !res.error ? extractPage(res.body, { wholeBody: true }) : null;
      const fetchedAt = new Date().toISOString();
      const snapshotId = await ctx.recordPageSnapshot({
        url: p.url,
        finalUrl: res.finalUrl,
        fetchMode: "raw",
        userAgent: res.userAgent,
        httpStatus: res.status,
        contentHash: res.body ? await sha256Hex(res.body) : null,
        textHash: ex ? await sha256Hex(ex.text) : null,
        html: res.body,
        text: ex?.text ?? null,
        error: res.error,
        fetchedAt,
      });
      const words = ex ? wordCount(ex.text) : 0;
      base.attempts.push({ mode: "plain", snapshotId, status: res.status, error: res.error, words });
      return {
        ...base,
        title: ex?.title ?? p.title,
        blocked: null,
        plain: ex ? { snapshotId, text: ex.text, title: ex.title, words, status: res.status, finalUrl: res.finalUrl, fetchedAt } : null,
        plainError: res.error ?? (ex ? null : `HTTP ${res.status}`),
      };
    });

    // Step 2: our browser for pages whose plain copy was refused or thin, one at a time within the time budget.
    const earlier = await ctx.fullestRenderedSnapshots(drafts.filter((d) => !d.blocked && (!d.plain || d.plain.words < THIN_WORDS)).map((d) => d.url));
    const pages: Page[] = [];
    for (const d of drafts) {
      const { blocked, plain, plainError, ...rest } = d;
      const done = (state: Page["state"], reason: string | null, source: Page["source"], text: string, title: string | null): Page => {
        if (state === "checked") texts.set(d.key, text);
        return {
          ...rest,
          title: title ?? rest.title,
          state,
          reason,
          source,
          excerpt: state === "checked" ? excerptOf(text) : null,
          names: state === "checked" ? namesOnPage({ title, text }, businesses) : [],
        };
      };
      if (blocked) {
        pages.push(done("unchecked", blocked, null, "", null));
        continue;
      }
      const plainSource: Page["source"] = plain && { mode: "plain", snapshotId: plain.snapshotId, status: plain.status, finalUrl: plain.finalUrl, fetchedAt: plain.fetchedAt, words: plain.words };
      if (plain && plain.words >= THIN_WORDS) {
        pages.push(done("checked", null, plainSource, plain.text, plain.title));
        continue;
      }
      let browser: { snapshotId: string; text: string; title: string | null; words: number; status: number | null; finalUrl: string | null; fetchedAt: string } | null = null;
      let browserError: string | null = null;
      const prior = earlier.get(d.url);
      if (prior && prior.words >= THIN_WORDS) {
        browser = { snapshotId: prior.snapshotId, text: prior.text, title: null, words: prior.words, status: null, finalUrl: null, fetchedAt: prior.fetchedAt };
      } else if (Date.now() - started > BROWSER_BUDGET_MS) {
        browserError = "this run ran out of time before our browser reached it";
      } else {
        try {
          const r = await ctx.renderUrl(d.url);
          const ex = r.html && !r.error ? extractPage(r.html, { wholeBody: true }) : null;
          const fetchedAt = new Date().toISOString();
          const snapshotId = await ctx.recordPageSnapshot({
            url: d.url,
            finalUrl: r.finalUrl,
            fetchMode: "rendered",
            userAgent: r.userAgent,
            httpStatus: r.status,
            contentHash: r.html ? await sha256Hex(r.html) : null,
            textHash: ex ? await sha256Hex(ex.text) : null,
            html: r.html,
            text: ex?.text ?? null,
            error: r.error,
            fetchedAt,
          });
          const words = ex ? wordCount(ex.text) : 0;
          rest.attempts.push({ mode: "browser", snapshotId, status: r.status, error: r.error, words });
          if (ex) browser = { snapshotId, text: ex.text, title: ex.title, words, status: r.status, finalUrl: r.finalUrl, fetchedAt };
          else browserError = r.error ?? `HTTP ${r.status}`;
        } catch (e) {
          if (ctx.signal.aborted) throw e;
          browserError = errorMessage(e);
        }
      }
      const best = [browser, plain].filter((c) => c !== null).sort((a, b) => b!.words - a!.words)[0] ?? null;
      if (best && best.words >= MIN_WORDS) {
        const mode = best === plain ? "plain" : prior && best.snapshotId === prior.snapshotId ? "earlier_browser" : "browser";
        pages.push(done("checked", null, { mode, snapshotId: best.snapshotId, status: best.status, finalUrl: best.finalUrl, fetchedAt: best.fetchedAt, words: best.words }, best.text, best.title ?? plain?.title ?? null));
        continue;
      }
      const why = [plainError ? `our plain fetch failed (${plainError})` : plain ? `our plain copy had only ${plain.words} words` : null, browserError ? `our browser: ${browserError}` : browser ? `our browser copy had only ${browser.words} words` : null].filter(Boolean).join("; ");
      pages.push(done("unchecked", `We couldn't read this page: ${why}.`, null, "", null));
    }

    return pages;
    };

    // Read pages until each line has PAGE_CAP pages read. A site that refuses our checker is passed over for the rest
    // of the run, and the next most-cited pages take its place. Pages robots.txt asks us not to fetch cost nothing
    // and don't count towards the cap either.
    const status = new Map<string, PageStatus>();
    const refused = new Set<string>();
    const chosenBy = new Map<string, Set<string>>();
    const byKey = new Map<string, Page>();
    let ownSites = cands.ownSites;
    for (;;) {
      const plan = planNext(cands.lists, status, refused, chosenBy);
      for (const p of plan.skip) {
        status.set(p.key, "skipped");
        byKey.set(p.key, { ...pageBase(p), state: "unchecked", reason: `We didn't fetch this page: ${p.site} refused our checker on another page this run.`, source: null, excerpt: null, attempts: [], names: [] });
      }
      if (!plan.fetch.length) break;
      const read = await checkBatch(plan.fetch);
      for (const page of read) {
        const owner = cands.suspects.get(page.key);
        // A directory named like a business: its own website unless it names at least two other businesses.
        if (owner && !(page.state === "checked" && page.names.filter((n) => n.business !== owner).length >= 2)) {
          status.set(page.key, "own");
          ownSites++;
          continue;
        }
        status.set(page.key, page.state === "checked" ? "read" : "failed");
        byKey.set(page.key, page);
        // Refused, not just missing: an HTTP 401, 403 or 429 (a 404 says nothing about the site's other pages).
        if (page.state === "unchecked" && /HTTP (401|403|429)\b/.test(page.reason ?? "")) refused.add(page.site);
      }
      // Once our time is up, later pages would only be marked "not reached in time": stop here; a rerun continues.
      if (read.some((p) => /ran out of time/.test(p.reason ?? ""))) break;
    }
    // Most-cited first, as before.
    const order = new Map(cands.lists.flatMap((l) => l.pages).map((p, i) => [p.key, i] as const));
    const pages = [...byKey.values()]
      .map((p) => (lines ? { ...p, lines: lines.map((l) => l.name).filter((n) => chosenBy.get(p.key)?.has(n)) } : p))
      .sort((a, b) => (order.get(a.key) ?? 0) - (order.get(b.key) ?? 0));

    // Different pages of one site that gave us exactly the same text: we read a shared shell (a consent, block or
    // loading page), not the pages themselves.
    for (const p of pages) {
      const t = texts.get(p.key);
      if (p.state !== "checked" || t === undefined) continue;
      const same = pages.filter((o) => o.site === p.site && o.url !== p.url && texts.get(o.key) === t);
      if (!same.length) continue;
      Object.assign(p, {
        state: "unchecked",
        reason: `We couldn't read this page: ${same.length + 1} different pages on ${p.site} gave us the same ${p.source?.words ?? 0} words, so we got a page shared across the site (often a consent, block or loading page), not this one.`,
        names: [],
      });
    }

    const out: CitedPages = {
      version: CITED_PAGES_VERSION,
      cap: PAGE_CAP,
      outsidePages: cands.outside,
      businesses: businesses.map((b) => ({ key: b.key, name: b.name, target: b.key === targetKey })),
      ...(lines ? { lines } : {}),
      ownSites,
      pages,
    };
    return { status: pages.some((p) => p.state === "unchecked" && /ran out of time/.test(p.reason ?? "")) ? "partial" : "done", output: out as unknown as JsonValue };
  },
};

export const WEB_PRESENCE_STAGES = [wpPages, wpAssess, wpSection] as const;
