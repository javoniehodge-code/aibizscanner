import { z } from "zod";
import { errorMessage } from "../../errors";
import { sha256Hex } from "../../json";
import type { JsonValue, StageContext, StageDefinition } from "../../types";
import { extractPage } from "./logic/extract";
import { compareTexts, JS_CHECK_VERSION, recommendationFor, verdictLabel, visitorKeyFacts, type JsVerdict } from "./logic/jscheck";
import { snapshots, type Snapshots } from "./schemas";

const MODULE = "website";
const CONCURRENCY = 3;

const verdict = z.enum(["key_facts_need_js", "content_needs_js", "minor", "same", "not_checked"]);

/** ws_render: our JavaScript check per approved page (raw text vs the same page after scripts ran). */
export const jsCheck = z
  .object({
    version: z.string(),
    pages: z.array(
      z
        .object({
          url: z.string(),
          verdict,
          label: z.string(),
          reason: z.string(),
          /** What to tell the business, when scripts hold back key facts or much of the content. */
          recommendation: z.string().nullable().optional(),
          rendered: z
            .object({
              snapshotId: z.string().nullable(),
              status: z.number().int().nullable(),
              finalUrl: z.string().nullable(),
              error: z.string().nullable(),
              title: z.string().nullable(),
              durationMs: z.number().int(),
              requests: z.object({ fetched: z.number().int(), refused: z.number().int(), skipped: z.number().int() }).strict(),
            })
            .strict(),
          /** The plain-fetch text compared against; fallback = this run's fetch failed, so our earlier good copy was used. */
          raw: z.object({ snapshotId: z.string(), fetchedAt: z.string().nullable(), fallback: z.boolean() }).strict().nullable(),
          rawWords: z.number().int(),
          renderedWords: z.number().int(),
          addedWords: z.number().int(),
          removedWords: z.number().int(),
          onlyRendered: z.array(z.string()),
          keyFactsOnlyRendered: z.array(z.object({ kind: z.enum(["price", "phone", "hours"]), text: z.string(), line: z.string() }).strict()),
          /**
           * The answer key for the AIs' key-fact extraction: prices, phone numbers and hours a visitor sees, from the
           * browser's copy (or our plain copy when the browser couldn't load the page). jsOnly = not in the plain copy.
           */
          answerKey: z
            .object({
              source: z.enum(["browser", "plain"]),
              snapshotId: z.string(),
              facts: z.array(z.object({ kind: z.enum(["price", "phone", "hours"]), text: z.string(), jsOnly: z.boolean() }).strict()),
            })
            .strict()
            .nullable(),
        })
        .strict(),
    ),
    counts: z.record(verdict, z.number().int()),
  })
  .strict();
export type JsCheck = z.infer<typeof jsCheck>;

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

export const wsRender: StageDefinition = {
  id: "ws_render",
  module: MODULE,
  label: "Website: JavaScript check (our browser)",
  inputs: ["ws_snapshot"],
  timeoutMs: 270_000,
  maxAttempts: 2,
  autoRun: true,
  parseParams: (raw) => {
    z.object({}).strict().parse(raw ?? {});
    return {};
  },
  output: jsCheck,
  async run(ctx) {
    const snap: Snapshots = input(ctx, "ws_snapshot", snapshots);
    const ours = await ctx.snapshotTexts(snap.pages.flatMap((p) => (p.snapshotId ? [p.snapshotId] : [])));
    const earlier = await ctx.latestGoodSnapshots(snap.pages.filter((p) => !(p.snapshotId && ours.has(p.snapshotId) && !p.error)).map((p) => p.url));
    const rawFor = (pg: Snapshots["pages"][number]) => {
      if (pg.snapshotId && !pg.error && ours.has(pg.snapshotId)) return { snapshotId: pg.snapshotId, fetchedAt: null, fallback: false, text: ours.get(pg.snapshotId)! };
      const e = earlier.get(pg.url);
      return e ? { snapshotId: e.snapshotId, fetchedAt: e.fetchedAt, fallback: true, text: e.text } : null;
    };

    const pages = await mapLimit(snap.pages, CONCURRENCY, async (pg): Promise<JsCheck["pages"][number]> => {
      const raw = rawFor(pg);
      const rawRef = raw && { snapshotId: raw.snapshotId, fetchedAt: raw.fetchedAt, fallback: raw.fallback };
      const notChecked = (reason: string, rendered: JsCheck["pages"][number]["rendered"], renderedWords = 0): JsCheck["pages"][number] => ({
        url: pg.url,
        verdict: "not_checked",
        label: verdictLabel("not_checked"),
        reason,
        rendered,
        raw: rawRef,
        rawWords: raw ? raw.text.split(/\s+/).filter(Boolean).length : 0,
        renderedWords,
        addedWords: 0,
        removedWords: 0,
        onlyRendered: [],
        keyFactsOnlyRendered: [],
        answerKey: raw ? { source: "plain", snapshotId: raw.snapshotId, facts: visitorKeyFacts(raw.text, null) } : null,
      });

      let r;
      try {
        r = await ctx.renderUrl(pg.url);
      } catch (e) {
        if (ctx.signal.aborted) throw e;
        return notChecked(`Our browser couldn't run: ${errorMessage(e)}`, { snapshotId: null, status: null, finalUrl: null, error: errorMessage(e), title: null, durationMs: 0, requests: { fetched: 0, refused: 0, skipped: 0 } });
      }
      const ex = r.html && !r.error ? extractPage(r.html) : null;
      const snapshotId = await ctx.recordPageSnapshot({
        url: pg.url,
        finalUrl: r.finalUrl,
        fetchMode: "rendered",
        userAgent: r.userAgent,
        httpStatus: r.status,
        contentHash: r.html ? await sha256Hex(r.html) : null,
        textHash: ex ? await sha256Hex(ex.text) : null,
        html: r.html,
        text: ex?.text ?? null,
        error: r.error,
        fetchedAt: new Date().toISOString(),
      });
      const rendered = { snapshotId, status: r.status, finalUrl: r.finalUrl, error: r.error, title: ex?.title ?? null, durationMs: Math.round(r.durationMs), requests: r.requests };
      if (!ex) return notChecked(r.error?.startsWith("The browser couldn't") ? r.error : `Our browser couldn't load the page: ${r.error ?? "no content"}`, rendered);
      if (!raw)
        return {
          ...notChecked(`Our plain fetch of this page failed (${pg.error ?? "no text"}) and there is no earlier copy to compare with.`, rendered, ex.wordCount),
          // The browser's copy still shows what a visitor sees; without a plain copy no fact can be marked JavaScript-only.
          answerKey: { source: "browser", snapshotId, facts: visitorKeyFacts(ex.text, null) },
        };
      const c = compareTexts(raw.text, ex.text);
      return {
        url: pg.url,
        verdict: c.verdict,
        label: verdictLabel(c.verdict),
        reason: c.reason,
        recommendation: recommendationFor(c.verdict, c.keyFactsOnlyRendered),
        rendered,
        raw: rawRef,
        rawWords: c.rawWords,
        renderedWords: c.renderedWords,
        addedWords: c.addedWords,
        removedWords: c.removedWords,
        onlyRendered: c.onlyRendered,
        keyFactsOnlyRendered: c.keyFactsOnlyRendered,
        answerKey: { source: "browser", snapshotId, facts: visitorKeyFacts(ex.text, raw.text) },
      };
    });

    const counts = Object.fromEntries(verdict.options.map((v) => [v, pages.filter((p) => p.verdict === v).length])) as Record<JsVerdict, number>;
    const out: JsCheck = { version: JS_CHECK_VERSION, pages, counts };
    return { status: counts.not_checked ? "partial" : "done", output: out as unknown as JsonValue };
  },
};
