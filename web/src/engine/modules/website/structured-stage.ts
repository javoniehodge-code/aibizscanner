import { z } from "zod";
import type { JsonValue, StageContext, StageDefinition } from "../../types";
import { jsCheck } from "./js-stage";
import { extractPage } from "./logic/extract";
import { pageName } from "./logic/section";
import { checkStructuredData, STRUCTURED_CHECK_VERSION, type CheckedPage } from "./logic/structured";
import { pageSetSpec, snapshots } from "./schemas";

const mark = z.enum(["g", "r", "k"]);

/** ws_structured: the facts in the site's code (JSON-LD) compared with what its pages show. */
export const structuredCheck = z
  .object({
    version: z.string(),
    pages: z.array(
      z
        .object({
          url: z.string(),
          name: z.string(),
          types: z.array(z.string()),
          blocks: z.number().int(),
          errors: z.number().int(),
          /** Where the code was read: our plain copy (what crawlers read), or our browser copy when no plain copy exists. */
          codeFrom: z.object({ snapshotId: z.string(), source: z.enum(["plain", "browser"]), fetchedAt: z.string().nullable() }).strict().nullable(),
        })
        .strict(),
    ),
    business: z.object({ url: z.string(), type: z.string() }).strict().nullable(),
    facts: z.array(
      z.object({ fact: z.string(), page: z.string(), pageUrl: z.string().nullable(), code: z.string(), mark, where: z.string(), title: z.string(), why: z.string(), fix: z.string() }).strict(),
    ),
    broken: z.array(z.object({ url: z.string(), name: z.string(), errors: z.number().int() }).strict()),
  })
  .strict();
export type StructuredCheck = z.infer<typeof structuredCheck>;

function input<T>(ctx: StageContext, stage: string, schema: z.ZodType<T>): T {
  const i = ctx.inputs[stage];
  if (!i) throw new Error(`Missing input ${stage}`);
  return schema.parse(i.output);
}

export const wsStructured: StageDefinition = {
  id: "ws_structured",
  module: "website",
  label: "Website: structured data check",
  inputs: ["ws_page_set", "ws_snapshot", "ws_render"],
  timeoutMs: 60_000,
  maxAttempts: 2,
  autoRun: true,
  parseParams: () => ({}),
  output: structuredCheck,
  async run(ctx) {
    const set = input(ctx, "ws_page_set", pageSetSpec);
    const snap = input(ctx, "ws_snapshot", snapshots);
    const js = input(ctx, "ws_render", jsCheck);

    // The code: this run's plain copy, else our latest good plain copy, else our browser copy.
    const ok = (p: (typeof snap.pages)[number]) => !!p.snapshotId && !p.error && p.status !== null && p.status >= 200 && p.status < 300;
    const earlier = await ctx.latestGoodSnapshots(snap.pages.filter((p) => !ok(p)).map((p) => p.url));
    const browserCopy = (url: string) => {
      const p = js.pages.find((x) => x.url === url);
      const id = p?.browserCopy?.snapshotId ?? (p?.answerKey?.source === "browser" ? p.answerKey.snapshotId : null) ?? (p?.rendered.error ? null : p?.rendered.snapshotId) ?? null;
      return id ? { snapshotId: id, fetchedAt: p?.browserCopy?.fetchedAt ?? null } : null;
    };
    const codeFrom = snap.pages.map((p) => {
      if (ok(p)) return { snapshotId: p.snapshotId!, source: "plain" as const, fetchedAt: null };
      const e = earlier.get(p.url);
      if (e) return { snapshotId: e.snapshotId, source: "plain" as const, fetchedAt: e.fetchedAt };
      const b = browserCopy(p.url);
      return b ? { snapshotId: b.snapshotId, source: "browser" as const, fetchedAt: b.fetchedAt } : null;
    });
    const html = await ctx.snapshotHtml(codeFrom.flatMap((c) => (c ? [c.snapshotId] : [])));
    // What a visitor sees: our browser copy, else the plain copy's text.
    const visibleIds = snap.pages.map((p, i) => browserCopy(p.url)?.snapshotId ?? codeFrom[i]?.snapshotId ?? null);
    const texts = await ctx.snapshotTexts(visibleIds.flatMap((x) => (x ? [x] : [])));

    const pages: CheckedPage[] = snap.pages.map((p, i) => {
      const h = codeFrom[i] ? html.get(codeFrom[i]!.snapshotId) : undefined;
      const ex = h ? extractPage(h) : null;
      const title = ex?.title ?? js.pages.find((x) => x.url === p.url)?.rendered.title ?? null;
      return { url: p.url, kind: p.kind, name: pageName({ kind: p.kind, title: p.title, url: p.url }, title), jsonLd: ex?.jsonLd ?? [], text: visibleIds[i] ? (texts.get(visibleIds[i]!) ?? null) : null };
    });
    const result = checkStructuredData(pages, { name: set.business?.name ?? new URL(set.website).hostname });
    const out: StructuredCheck = {
      version: STRUCTURED_CHECK_VERSION,
      ...result,
      pages: result.pages.map((p, i) => ({ ...p, codeFrom: codeFrom[i] ?? null })),
    };
    return { status: codeFrom.every(Boolean) ? "done" : "partial", output: out as unknown as JsonValue };
  },
};
