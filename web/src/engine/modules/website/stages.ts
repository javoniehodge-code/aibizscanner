import { z } from "zod";
import { NonRetryableError } from "../../errors";
import { sha256Hex } from "../../json";
import type { JsonObject, JsonValue, StageContext, StageDefinition } from "../../types";
import { pageKeyOf } from "../prompt-analysis/logic/sources";
import { extractLinks, extractPage, parseSitemap } from "./logic/extract";
import { excluded, onSite, pageKind, suggestPages, type Candidate } from "./logic/pages";
import { CRAWLERS, permission, ROBOTS_REGISTRY_VERSION, sitemapsIn, type RobotsFile } from "./logic/robots";
import { discoverParams, discovery, pageSetSpec, snapshots, type Discovery, type PageSetSpec, type Snapshots } from "./schemas";

export const MODULE = "website";
/** Bounds on discovery: sitemap files read and candidate pages kept (website-discovery-accessibility.md §3, §10). */
const MAX_SITEMAP_FILES = 4;
const MAX_CANDIDATES = 500;
const SNAPSHOT_CONCURRENCY = 3;

function input<T>(ctx: StageContext, stage: string, schema: z.ZodType<T>): T & { runId: string } {
  const i = ctx.inputs[stage];
  if (!i) throw new Error(`Missing input ${stage}`);
  return { ...schema.parse(i.output), runId: i.runId };
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

// ---------------------------------------------------------------------------------------------------------------
// ws_discover: find the site's pages and suggest which to check (queued from the website pages screen)
// ---------------------------------------------------------------------------------------------------------------

export const wsDiscover: StageDefinition = {
  id: "ws_discover",
  module: MODULE,
  label: "Website 1/3: find pages",
  inputs: [],
  timeoutMs: 120_000,
  maxAttempts: 2,
  parseParams: (raw) => discoverParams.parse(raw ?? {}) as unknown as JsonObject,
  output: discovery,
  async run(ctx) {
    const p = discoverParams.parse(ctx.params);
    const home = new URL(p.website);
    const siteDomains = [...new Set([home.hostname.replace(/^www\./, ""), ...p.domains.map((d) => d.toLowerCase().replace(/^www\./, ""))])];

    const robotsUrl = new URL("/robots.txt", home.origin).toString();
    const r = await ctx.fetchUrl(robotsUrl, { accept: "text", maxBytes: 500_000 });
    const robots: RobotsFile & { fetchedAt: string } = { url: robotsUrl, status: r.status, body: r.body, error: r.error, fetchedAt: new Date().toISOString() };

    const h = await ctx.fetchUrl(p.website, { accept: "html" });
    if (!h.body) throw new NonRetryableError(`The home page couldn't be fetched: ${h.error ?? `HTTP ${h.status}`}`);
    const homeUrl = h.finalUrl ?? p.website;
    if (!siteDomains.some((d) => onSite(homeUrl, [d]))) siteDomains.push(new URL(homeUrl).hostname.replace(/^www\./, ""));

    const found = new Map<string, Candidate>();
    const add = (url: string, source: Candidate["sources"][number], linkText: string | null = null) => {
      if (!onSite(url, siteDomains) || excluded(url)) return;
      const key = pageKeyOf(url);
      if (!key) return;
      const prev = found.get(key);
      if (prev) {
        if (!prev.sources.includes(source)) prev.sources.push(source);
        prev.linkText ??= linkText;
        return;
      }
      found.set(key, { url, kind: pageKind(url), sources: [source], linkText });
    };
    add(homeUrl, "home");
    for (const l of extractLinks(h.body, homeUrl)) add(l.url, l.inNav ? "nav" : "link", l.text || null);
    for (const c of p.cited) add(c, "cited");

    // Sitemaps advertised in robots.txt, else /sitemap.xml; an index is followed one level, within the file budget.
    const queue = sitemapsIn(robots).slice(0, MAX_SITEMAP_FILES);
    if (!queue.length) queue.push(new URL("/sitemap.xml", home.origin).toString());
    const sitemaps: Discovery["sitemaps"] = [];
    while (queue.length && sitemaps.length < MAX_SITEMAP_FILES) {
      const url = queue.shift()!;
      const s = await ctx.fetchUrl(url, { accept: "xml", maxBytes: 5_000_000 });
      const parsed = s.body ? parseSitemap(s.body) : { kind: "unknown" as const, locs: [] };
      sitemaps.push({ url, status: s.status, error: s.error, kind: parsed.kind, urls: parsed.locs.length });
      if (parsed.kind === "index") queue.push(...parsed.locs.filter((u) => !/\.gz$/i.test(u)).slice(0, MAX_SITEMAP_FILES));
      else for (const loc of parsed.locs) add(loc, "sitemap");
    }

    const all = [...found.values()];
    const out: Discovery = {
      website: p.website,
      siteDomains,
      homepage: { url: p.website, finalUrl: h.finalUrl, status: h.status, error: h.error, title: extractPage(h.body).title },
      robots,
      sitemaps,
      candidates: all.slice(0, MAX_CANDIDATES),
      suggested: suggestPages(all, { services: p.services, locations: p.locations, cap: p.cap }),
      cap: p.cap,
      limits: { sitemapFilesRead: sitemaps.length, candidatesTruncated: all.length > MAX_CANDIDATES },
    };
    return { status: "done", output: out as unknown as JsonValue };
  },
};

// ---------------------------------------------------------------------------------------------------------------
// ws_page_set: the approved list of pages, frozen into the pipeline (queued from the website pages screen)
// ---------------------------------------------------------------------------------------------------------------

export const wsPageSet: StageDefinition = {
  id: "ws_page_set",
  module: MODULE,
  label: "Website 2/3: approved pages",
  inputs: [],
  timeoutMs: 10_000,
  maxAttempts: 1,
  parseParams: (raw) => pageSetSpec.parse(raw) as unknown as JsonObject,
  output: pageSetSpec,
  async run(ctx) {
    return { status: "done", output: pageSetSpec.parse(ctx.params) as unknown as JsonValue };
  },
};

// ---------------------------------------------------------------------------------------------------------------
// ws_snapshot: our own raw fetch of every approved page, plus published crawler permissions
// ---------------------------------------------------------------------------------------------------------------

export const wsSnapshot: StageDefinition = {
  id: "ws_snapshot",
  module: MODULE,
  label: "Website 3/3: snapshot pages and crawler rules",
  inputs: ["ws_page_set", "ws_discover"],
  timeoutMs: 180_000,
  maxAttempts: 2,
  autoRun: true,
  parseParams: (raw) => {
    z.object({}).strict().parse(raw ?? {});
    return {};
  },
  output: snapshots,
  async run(ctx) {
    const set: PageSetSpec = input(ctx, "ws_page_set", pageSetSpec);
    const disc: Discovery = input(ctx, "ws_discover", discovery);
    const robotsHost = new URL(disc.robots.url).host;

    const pages = await mapLimit(set.pages, SNAPSHOT_CONCURRENCY, async (pg): Promise<Snapshots["pages"][number]> => {
      const res = await ctx.fetchUrl(pg.url, { accept: "html" });
      const ex = res.body ? extractPage(res.body) : null;
      const snapshotId = await ctx.recordPageSnapshot({
        url: pg.url,
        finalUrl: res.finalUrl,
        fetchMode: "raw",
        userAgent: res.userAgent,
        httpStatus: res.status,
        contentHash: res.body ? await sha256Hex(res.body) : null,
        textHash: ex ? await sha256Hex(ex.text) : null,
        html: res.body,
        text: ex?.text ?? null,
        error: res.error,
        fetchedAt: new Date().toISOString(),
      });
      const target = res.finalUrl ?? pg.url;
      const sameHost = new URL(target).host === robotsHost;
      const permissions = Object.fromEntries(
        CRAWLERS.map((c) => [
          c.token,
          sameHost ? permission(disc.robots, target, c.token) : { verdict: "unconfirmed" as const, line: null, reason: `The page is on ${new URL(target).host}; its robots.txt wasn't read` },
        ]),
      );
      return {
        url: pg.url,
        kind: pg.kind,
        reason: pg.reason,
        snapshotId,
        finalUrl: res.finalUrl,
        status: res.status,
        error: res.error,
        truncated: res.truncated,
        title: ex?.title ?? null,
        description: ex?.description ?? null,
        canonical: ex?.canonical ?? null,
        metaRobots: ex?.metaRobots ?? null,
        headings: ex?.headings ?? [],
        wordCount: ex?.wordCount ?? 0,
        textExcerpt: (ex?.text ?? "").slice(0, 600),
        jsonLdTypes: [...new Set(ex?.jsonLd.flatMap((j) => j.types) ?? [])],
        jsonLdErrors: ex?.jsonLd.filter((j) => j.error).length ?? 0,
        microdataTypes: ex?.microdataTypes ?? [],
        permissions,
      };
    });
    const out: Snapshots = { robots: { url: disc.robots.url, status: disc.robots.status, registryVersion: ROBOTS_REGISTRY_VERSION }, pages };
    return { status: pages.every((p) => !p.error) ? "done" : "partial", output: out as unknown as JsonValue };
  },
};

export const WEBSITE_STAGES = [wsDiscover, wsPageSet, wsSnapshot] as const;
