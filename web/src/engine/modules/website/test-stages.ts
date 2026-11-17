import { z } from "zod";
import { ENGINE_NAMES, type EngineIndex, type ReadAttempt } from "../../answers";
import { MissingPricingError, NonRetryableError, SpendingCapError, errorMessage } from "../../errors";
import type { JsonValue, StageContext, StageDefinition } from "../../types";
import { ENGINE_MODELS } from "../prompt-analysis/models";
import {
  matches,
  parseReadReply,
  readInstruction,
  readOutcome,
  searchOutcome,
  searchPrompt,
  targetKeys,
  TEST_TEMPLATE_VERSION,
  verifiedPassages,
  type ReadStatus,
  type SearchStatus,
} from "./logic/findread";
import { pageSetSpec, snapshots, type PageSetSpec, type Snapshots } from "./schemas";

const MODULE = "website";
const CALL_TIMEOUT_MS = 120_000;
const STAGE_TIMEOUT_MS = 280_000;
const cap = (xs: readonly string[], n = 30) => xs.slice(0, n);

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
// Outputs
// ---------------------------------------------------------------------------------------------------------------

const searchStatus = z.enum(["found", "not_found", "unconfirmed", "not_tested"]);
const readStatus = z.enum(["readable", "partial", "unsuccessful", "unconfirmed", "not_tested"]);

export const searchTests = z
  .object({
    engine: z.number().int().min(0).max(2),
    model: z.string(),
    configured: z.boolean(),
    templateVersion: z.string(),
    pages: z.array(
      z
        .object({
          url: z.string(),
          status: searchStatus,
          how: z.enum(["cited", "result"]).nullable(),
          matchedUrl: z.string().nullable(),
          reason: z.string(),
          prompt: z.string(),
          searchQueries: z.array(z.string()),
          sources: z.array(z.string()),
          citations: z.array(z.string()),
          answerExcerpt: z.string(),
          servedModel: z.string().nullable(),
        })
        .strict(),
    ),
  })
  .strict();
export type SearchTests = z.infer<typeof searchTests>;

export const readTests = z
  .object({
    engine: z.number().int().min(0).max(2),
    model: z.string(),
    configured: z.boolean(),
    templateVersion: z.string(),
    pages: z.array(
      z
        .object({
          url: z.string(),
          status: readStatus,
          reason: z.string(),
          attempts: z.array(z.object({ url: z.string(), status: z.enum(["success", "error", "unknown"]), detail: z.string().nullable(), retrievedAt: z.string().nullable(), title: z.string().nullable() }).strict()),
          provenance: z.enum(["live", "cached", "unknown"]),
          titleReported: z.string().nullable(),
          passages: z.array(z.object({ text: z.string(), onPage: z.boolean() }).strict()),
          /** page_snapshot row holding the content the provider's tool returned (engine_tool), when it returned any. */
          evidenceSnapshotId: z.string().nullable(),
          replyExcerpt: z.string(),
          servedModel: z.string().nullable(),
        })
        .strict(),
    ),
  })
  .strict();
export type ReadTests = z.infer<typeof readTests>;

// ---------------------------------------------------------------------------------------------------------------
// Search test: can the engine's own search surface the page? (one fresh request per page)
// ---------------------------------------------------------------------------------------------------------------

function searchStage(engine: EngineIndex): StageDefinition {
  const name = ENGINE_NAMES[engine];
  const spec = ENGINE_MODELS[engine];
  return {
    id: `ws_search_${name.toLowerCase()}`,
    module: MODULE,
    label: `Website tests: ${name} search`,
    inputs: ["ws_page_set", "ws_snapshot"],
    timeoutMs: STAGE_TIMEOUT_MS,
    maxAttempts: 2,
    autoRun: true,
    parseParams: () => ({}),
    output: searchTests,
    async run(ctx) {
      const set: PageSetSpec = input(ctx, "ws_page_set", pageSetSpec);
      const snap: Snapshots = input(ctx, "ws_snapshot", snapshots);
      if (!set.business) throw new NonRetryableError("This page list was approved before the website tests existed. Approve it again on the Website pages screen.");
      const client = ctx.answerEngine(engine);
      const notTested = (url: string, prompt: string, reason: string): SearchTests["pages"][number] => ({ url, status: "not_tested", how: null, matchedUrl: null, reason, prompt, searchQueries: [], sources: [], citations: [], answerExcerpt: "", servedModel: null });
      let stop: string | null = null;
      const pages = await mapLimit(snap.pages, spec.concurrency, async (pg) => {
        const prompt = searchPrompt(set.business!, pg);
        if (!client) return notTested(pg.url, prompt, `${name} is not configured (its API key is not set)`);
        if (stop) return notTested(pg.url, prompt, stop);
        const request = { question: prompt, location: null, maxSearches: spec.maxSearches };
        try {
          const r = await ctx.paidCall({ provider: client.provider, model: client.model, estimate: client.estimate(request) }, async (signal) => {
            const res = await client.ask(request, AbortSignal.any([signal, AbortSignal.timeout(CALL_TIMEOUT_MS)]));
            return { result: res, usage: res.usage };
          });
          const o = searchOutcome(r, targetKeys([pg.url, pg.finalUrl, pg.canonical]));
          return { url: pg.url, ...o, prompt, searchQueries: cap(r.searchQueries), sources: cap(r.sources), citations: cap(r.citations), answerExcerpt: r.text.slice(0, 800), servedModel: r.servedModel };
        } catch (e) {
          if (e instanceof SpendingCapError || e instanceof MissingPricingError) stop = errorMessage(e);
          return notTested(pg.url, prompt, `The request failed: ${errorMessage(e)}`);
        }
      });
      const out: SearchTests = { engine, model: client?.model ?? spec.model, configured: !!client, templateVersion: TEST_TEMPLATE_VERSION, pages };
      return { status: pages.every((p) => p.status !== "not_tested") ? "done" : "partial", output: out as unknown as JsonValue };
    },
  };
}

// ---------------------------------------------------------------------------------------------------------------
// Reading test: can the engine's own page-reading tool obtain the page's information?
// ---------------------------------------------------------------------------------------------------------------

function readStage(engine: EngineIndex): StageDefinition {
  const name = ENGINE_NAMES[engine];
  const spec = ENGINE_MODELS[engine];
  return {
    id: `ws_read_${name.toLowerCase()}`,
    module: MODULE,
    label: `Website tests: ${name} reads each page`,
    inputs: ["ws_page_set", "ws_snapshot"],
    timeoutMs: STAGE_TIMEOUT_MS,
    maxAttempts: 2,
    autoRun: true,
    parseParams: () => ({}),
    output: readTests,
    async run(ctx) {
      const snap: Snapshots = input(ctx, "ws_snapshot", snapshots);
      const client = ctx.answerEngine(engine);
      const ours = await ctx.snapshotTexts(snap.pages.flatMap((p) => (p.snapshotId ? [p.snapshotId] : [])));
      const notTested = (url: string, reason: string): ReadTests["pages"][number] => ({ url, status: "not_tested", reason, attempts: [], provenance: "unknown", titleReported: null, passages: [], evidenceSnapshotId: null, replyExcerpt: "", servedModel: null });
      let stop: string | null = null;
      const pages = await mapLimit(snap.pages, spec.concurrency, async (pg): Promise<ReadTests["pages"][number]> => {
        if (!client) return notTested(pg.url, `${name} is not configured (its API key is not set)`);
        if (!client.readPage) return notTested(pg.url, `${name} has no page-reading tool in this configuration`);
        if (stop) return notTested(pg.url, stop);
        const request = { url: pg.url, instruction: readInstruction(pg.url) };
        try {
          const r = await ctx.paidCall({ provider: client.provider, model: client.model, estimate: client.estimateRead?.(request) ?? client.estimate({ question: request.instruction, location: null, maxSearches: 1 }) }, async (signal) => {
            const res = await client.readPage!(request, AbortSignal.any([signal, AbortSignal.timeout(CALL_TIMEOUT_MS)]));
            return { result: res, usage: res.usage };
          });
          const keys = targetKeys([pg.url, pg.finalUrl, pg.canonical]);
          const mine: ReadAttempt[] = r.attempts.filter((a) => matches(a.url, keys));
          const returned = mine.find((a) => a.content)?.content ?? null;
          const reply = parseReadReply(r.text);
          const onPage = verifiedPassages(reply.passages, [pg.snapshotId ? (ours.get(pg.snapshotId) ?? null) : null, returned]);
          const o = r.status === "refused" ? { status: "unsuccessful" as ReadStatus, reason: `${name} declined to answer` } : readOutcome(r.attempts, reply, onPage, keys);
          // What the provider's tool returned is evidence in its own right (never our fetch relabelled).
          const evidenceSnapshotId = mine.length
            ? await ctx.recordPageSnapshot({
                url: pg.url,
                finalUrl: mine[0]!.url,
                fetchMode: "engine_tool",
                engine: name.toLowerCase() as "chatgpt" | "claude" | "gemini",
                userAgent: `${client.provider} ${client.model} page-reading tool`,
                httpStatus: null,
                contentHash: null,
                textHash: null,
                html: null,
                text: returned,
                error: mine.every((a) => a.status === "error") ? mine.map((a) => a.detail ?? "error").join(", ") : null,
                fetchedAt: mine[0]!.retrievedAt ?? new Date().toISOString(),
              })
            : null;
          return {
            url: pg.url,
            ...o,
            attempts: r.attempts.map((a) => ({ url: a.url, status: a.status, detail: a.detail, retrievedAt: a.retrievedAt, title: a.title })),
            provenance: r.provenance,
            titleReported: reply.title,
            passages: reply.passages.map((text, i) => ({ text, onPage: onPage[i] ?? false })),
            evidenceSnapshotId,
            replyExcerpt: r.text.slice(0, 800),
            servedModel: r.servedModel,
          };
        } catch (e) {
          if (e instanceof SpendingCapError || e instanceof MissingPricingError) stop = errorMessage(e);
          return notTested(pg.url, `The request failed: ${errorMessage(e)}`);
        }
      });
      const out: ReadTests = { engine, model: client?.model ?? spec.model, configured: !!client, templateVersion: TEST_TEMPLATE_VERSION, pages };
      return { status: pages.every((p) => p.status !== "not_tested") ? "done" : "partial", output: out as unknown as JsonValue };
    },
  };
}

// ---------------------------------------------------------------------------------------------------------------
// ws_findread: one row per page and engine, with the combined label and the counts (§8), in plain code
// ---------------------------------------------------------------------------------------------------------------

export const findRead = z
  .object({
    pages: z.array(
      z
        .object({
          url: z.string(),
          kind: z.string(),
          reason: z.string(),
          title: z.string().nullable(),
          results: z.array(z.object({ search: searchStatus, read: readStatus, label: z.string() }).strict()).length(3),
        })
        .strict(),
    ),
    /** Per engine: pages found and read, out of every selected page (null when nothing ran). */
    foundAndRead: z.array(z.number().int().nullable()).length(3),
    selectedPageCount: z.number().int(),
  })
  .strict();
export type FindRead = z.infer<typeof findRead>;

export function combinedLabel(search: SearchStatus, read: ReadStatus): string {
  if (search === "not_tested" && read === "not_tested") return "Not tested";
  if (read === "partial") return `${search === "found" ? "Found" : search === "not_found" ? "Not found in search" : "Search unconfirmed"}; partly read`;
  if (search === "found" && read === "readable") return "Found & read";
  if (search === "found" && read === "unsuccessful") return "Found, but could not read";
  if (search === "not_found" && read === "readable") return "Read using direct link; not found in search";
  if (search === "not_found" && read === "unsuccessful") return "Not found or read; reason not confirmed";
  const s = { found: "Found", not_found: "Not found in search", unconfirmed: "Search unconfirmed", not_tested: "Search not tested" }[search];
  const r = { readable: "read", unsuccessful: "could not read", unconfirmed: "reading unconfirmed", not_tested: "reading not tested", partial: "partly read" }[read];
  return `${s}; ${r}`;
}

const SEARCH_STAGES = [0, 1, 2].map((e) => `ws_search_${ENGINE_NAMES[e]!.toLowerCase()}`);
const READ_STAGES = [0, 1, 2].map((e) => `ws_read_${ENGINE_NAMES[e]!.toLowerCase()}`);

export const wsFindRead: StageDefinition = {
  id: "ws_findread",
  module: MODULE,
  label: "Website tests: combine find & read",
  inputs: ["ws_snapshot", ...SEARCH_STAGES, ...READ_STAGES],
  timeoutMs: 20_000,
  maxAttempts: 1,
  autoRun: true,
  parseParams: () => ({}),
  output: findRead,
  async run(ctx) {
    const snap = input(ctx, "ws_snapshot", snapshots);
    const search = SEARCH_STAGES.map((s) => input(ctx, s, searchTests));
    const read = READ_STAGES.map((s) => input(ctx, s, readTests));
    const pages = snap.pages.map((pg) => ({
      url: pg.url,
      kind: pg.kind,
      reason: pg.reason,
      title: pg.title,
      results: [0, 1, 2].map((e) => {
        const s = search[e]!.pages.find((p) => p.url === pg.url)?.status ?? "not_tested";
        const r = read[e]!.pages.find((p) => p.url === pg.url)?.status ?? "not_tested";
        return { search: s, read: r, label: combinedLabel(s, r) };
      }),
    }));
    const foundAndRead = [0, 1, 2].map((e) => {
      const ran = pages.some((p) => p.results[e]!.search !== "not_tested" || p.results[e]!.read !== "not_tested");
      return ran ? pages.filter((p) => p.results[e]!.search === "found" && p.results[e]!.read === "readable").length : null;
    });
    const out: FindRead = { pages, foundAndRead, selectedPageCount: pages.length };
    return { status: "done", output: out as unknown as JsonValue };
  },
};

export const TEST_STAGES = [...([0, 1, 2] as const).map(searchStage), ...([0, 1, 2] as const).map(readStage), wsFindRead] as const;
