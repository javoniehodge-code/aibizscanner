import { z } from "zod";
import { ENGINE_NAMES, type EngineIndex } from "../../answers";
import { errorMessage, MissingPricingError, NonRetryableError, SpendingCapError } from "../../errors";
import type { ModelSpec } from "../../llm";
import type { JsonValue, StageContext, StageDefinition } from "../../types";
import { ENGINE_MODELS } from "../prompt-analysis/models";
import { promptSetSpec } from "../prompt-analysis/schemas";
import { jsCheck } from "../website/js-stage";
import { pageName } from "../website/logic/section";
import { pageSetSpec, snapshots } from "../website/schemas";
import { assessWebsite } from "./instructions/assess-website";
import { scoreAnswers } from "./instructions/score-answers";
import {
  answerInstruction,
  claimHolds,
  answerMaterial,
  buildBundle,
  CONTENT_CHECK_VERSION,
  isNotStated,
  notStatedVerdict,
  parseAnswers,
  quoteOnPage,
  resolveWebsiteStatus,
  type Verdict,
  type WebsiteStatus,
} from "./logic";
import { standardFor, STANDARDS } from "./standards";

const MODULE = "content";

/** The model for our website assessment (the same one used to classify sources). */
export const CONTENT_MODEL: ModelSpec = {
  provider: "anthropic",
  model: "claude-haiku-5-5",
  capabilities: { temperature: false, structuredOutput: "json_schema", maxOutputTokens: 8000 },
  settings: { effort: "low" },
};

/**
 * The model that scores the AIs' answers (Clear & complete and Distinctive). Owner decision 18 Nov 2026: Haiku held
 * reworded answers to the pages' exact words (MVP Miami), so scoring uses Sonnet; its "wrong" / "not on your website"
 * verdicts still need a claim that plain code checks (claimHolds).
 */
export const SCORING_MODEL: ModelSpec = {
  provider: "anthropic",
  model: "claude-sonnet-5-5",
  capabilities: { temperature: false, structuredOutput: "json_schema", maxOutputTokens: 8000 },
  settings: { effort: "medium" },
};

function input<T>(ctx: StageContext, stage: string, schema: z.ZodType<T>): T {
  const i = ctx.inputs[stage];
  if (!i) throw new Error(`Missing input ${stage}`);
  return schema.parse(i.output);
}

// ---------------------------------------------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------------------------------------------

const fact = z.object({ id: z.string(), bucket: z.enum(["core", "relevant"]), name: z.string(), lookFor: z.string(), question: z.string() }).strict();
const bundlePage = z.object({ ref: z.string(), url: z.string(), name: z.string(), text: z.string(), words: z.number().int(), truncated: z.boolean(), source: z.enum(["browser", "plain"]) }).strict();

/** cc_bundle: the business, the approved fact list and the page text every assessor sees. */
export const contentBundle = z
  .object({
    version: z.string(),
    business: z.object({ name: z.string(), location: z.string(), category: z.string() }).strict(),
    standard: z.object({ id: z.string(), version: z.string(), label: z.string(), noun: z.string().optional(), facts: z.array(fact) }).strict(),
    pages: z.array(bundlePage),
    leftOut: z.array(z.string()),
  })
  .strict();
export type ContentBundle = z.infer<typeof contentBundle>;

const quote = z.object({ ref: z.string(), text: z.string() }).strict();
const websiteStatus = z.enum(["enough", "partial", "not_enough", "not_applicable", "unverified"]);

/** What the assessor returns (validated before use). */
const assessment = z
  .object({
    items: z.array(
      z
        .object({
          id: z.string(),
          status: z.enum(["enough", "partial", "not_enough", "not_applicable"]),
          provides: z.string(),
          missing: z.string().nullable(),
          quotes: z.array(quote).max(3),
          fix: z.string().nullable(),
        })
        .strict(),
    ),
  })
  .strict();

/** cc_baseline: our assessment of the website, fact by fact, with verified quotes. */
export const contentBaseline = z
  .object({
    model: z.string(),
    facts: z.array(
      z
        .object({
          id: z.string(),
          status: websiteStatus,
          proposed: z.enum(["enough", "partial", "not_enough", "not_applicable"]),
          provides: z.string(),
          missing: z.string().nullable(),
          quotes: z.array(quote),
          rejectedQuotes: z.number().int(),
          fix: z.string().nullable(),
        })
        .strict(),
    ),
  })
  .strict();
export type ContentBaseline = z.infer<typeof contentBaseline>;

/** cc_answer_*: one AI's website-only answers (no tools). */
export const contentAnswers = z
  .object({
    engine: z.number().int().min(0).max(2),
    model: z.string(),
    servedModel: z.string().nullable(),
    configured: z.boolean(),
    instruction: z.string(),
    status: z.enum(["ok", "refused", "unreadable", "not_tested"]),
    reason: z.string().nullable(),
    answers: z.record(z.string(), z.string()),
    replyExcerpt: z.string(),
  })
  .strict();
export type ContentAnswers = z.infer<typeof contentAnswers>;

const verdict = z.enum(["supported", "partial", "wrong", "unsupported", "not_answered", "correctly_not_stated", "not_tested"]);
const judged = z.object({ items: z.array(z.object({ engine: z.number().int(), id: z.string(), verdict: z.enum(["supported", "partial", "wrong", "unsupported"]), claim: z.string().nullable(), reason: z.string() }).strict()) }).strict();

/** cc_score: every fact with the website's status and each AI's answer and verdict. */
export const contentScore = z
  .object({
    version: z.string(),
    standard: z.object({ id: z.string(), version: z.string(), label: z.string() }).strict(),
    business: z.object({ name: z.string(), location: z.string(), category: z.string() }).strict(),
    pages: z.array(z.object({ ref: z.string(), url: z.string(), name: z.string(), words: z.number().int(), truncated: z.boolean() }).strict()),
    leftOut: z.array(z.string()),
    models: z.object({ assessor: z.string(), scorer: z.string().optional(), engines: z.array(z.string().nullable()).length(3) }).strict(),
    facts: z.array(
      z
        .object({
          id: z.string(),
          bucket: z.enum(["core", "relevant"]),
          name: z.string(),
          lookFor: z.string(),
          website: z.object({ status: websiteStatus, provides: z.string(), missing: z.string().nullable(), quotes: z.array(quote), fix: z.string().nullable() }).strict(),
          answers: z
            .array(
              z
                .object({
                  answer: z.string().nullable(),
                  verdict,
                  reason: z.string(),
                  /** For wrong / unsupported: the answer's words at fault, checked against the answer and the pages. */
                  claim: z.string().nullable().optional(),
                  /** The scorer's verdict when plain code dropped it for lack of evidence. */
                  overruled: z.string().optional(),
                })
                .strict(),
            )
            .length(3),
        })
        .strict(),
    ),
  })
  .strict();
export type ContentScore = z.infer<typeof contentScore>;

// ---------------------------------------------------------------------------------------------------------------
// cc_bundle (plain code)
// ---------------------------------------------------------------------------------------------------------------

export const ccBundle: StageDefinition = {
  id: "cc_bundle",
  module: MODULE,
  label: "Clear & complete 1/4: the pages and the fact list",
  inputs: ["pa_prompt_set", "ws_page_set", "ws_snapshot", "ws_render"],
  timeoutMs: 30_000,
  maxAttempts: 2,
  autoRun: true,
  parseParams: (raw) => {
    const p = z.object({ standard: z.string().optional() }).strict().parse(raw ?? {});
    const out: { standard?: string } = {};
    if (p.standard) out.standard = p.standard;
    return out as Record<string, string>;
  },
  output: contentBundle,
  async run(ctx) {
    const target = input(ctx, "pa_prompt_set", promptSetSpec).target;
    const set = input(ctx, "ws_page_set", pageSetSpec);
    const snap = input(ctx, "ws_snapshot", snapshots);
    const js = input(ctx, "ws_render", jsCheck);
    const chosen = typeof ctx.params.standard === "string" ? STANDARDS.find((s) => s.id === ctx.params.standard) : standardFor(target.category);
    if (!chosen) throw new NonRetryableError(`No approved decision-fact list for the category "${target.category}". Add one in content/standards.ts after the owner approves it, or run with {"standard": "<id>"}.`);

    // What a visitor sees: our browser copy, else our latest good plain copy.
    const browserId = (url: string) => {
      const p = js.pages.find((x) => x.url === url);
      return p?.browserCopy?.snapshotId ?? (p?.answerKey?.source === "browser" ? p.answerKey.snapshotId : null) ?? (p && !p.rendered.error ? p.rendered.snapshotId : null) ?? null;
    };
    const browserTexts = await ctx.snapshotTexts(snap.pages.flatMap((p) => (browserId(p.url) ? [browserId(p.url)!] : [])));
    const plain = await ctx.latestGoodSnapshots(snap.pages.filter((p) => !(browserId(p.url) && browserTexts.has(browserId(p.url)!))).map((p) => p.url));
    const pages = snap.pages.map((p) => {
      const b = browserId(p.url);
      const text = b ? (browserTexts.get(b) ?? null) : null;
      const title = js.pages.find((x) => x.url === p.url)?.rendered.title ?? null;
      return { url: p.url, name: pageName({ kind: p.kind, title: p.title, url: p.url }, title), text: text ?? plain.get(p.url)?.text ?? null, source: (text ? "browser" : "plain") as "browser" | "plain" };
    });
    const bundle = buildBundle(pages);
    if (!bundle.pages.length) throw new NonRetryableError("No page text is available: run the website snapshots or the JavaScript check first.");
    const out: ContentBundle = {
      version: CONTENT_CHECK_VERSION,
      business: { name: set.business?.name ?? target.name, location: set.business?.location ?? target.location, category: target.category },
      standard: { id: chosen.id, version: chosen.version, label: chosen.label, noun: chosen.noun, facts: chosen.facts },
      pages: bundle.pages,
      leftOut: bundle.leftOut,
    };
    return { status: "done", output: out as unknown as JsonValue };
  },
};

// ---------------------------------------------------------------------------------------------------------------
// cc_baseline (one model call; quotes checked in plain code)
// ---------------------------------------------------------------------------------------------------------------

export const ccBaseline: StageDefinition = {
  id: "cc_baseline",
  module: MODULE,
  label: "Clear & complete 2/4: our assessment of the website",
  inputs: ["cc_bundle"],
  timeoutMs: 180_000,
  maxAttempts: 2,
  autoRun: true,
  instructions: [assessWebsite],
  parseParams: () => ({}),
  output: contentBaseline,
  async run(ctx) {
    const b = input(ctx, "cc_bundle", contentBundle);
    const res = await ctx.llm({
      instruction: assessWebsite,
      model: CONTENT_MODEL,
      input: { business: b.business, facts: b.standard.facts.map((f) => ({ id: f.id, bucket: f.bucket, name: f.name, lookFor: f.lookFor })), pages: b.pages.map((p) => ({ ref: p.ref, name: p.name, url: p.url, text: p.text })) },
      output: assessment,
    });
    const byId = new Map(res.items.map((i) => [i.id, i]));
    const facts = b.standard.facts.map((f) => {
      const item = byId.get(f.id);
      if (!item) return { id: f.id, status: "unverified" as WebsiteStatus, proposed: "not_enough" as const, provides: "The assessment gave no answer for this fact.", missing: null, quotes: [], rejectedQuotes: 0, fix: null };
      const valid = item.quotes.filter((q) => quoteOnPage(q, b.pages));
      const status = resolveWebsiteStatus(f, item.status, valid.length);
      return { id: f.id, status, proposed: item.status, provides: item.provides, missing: item.missing, quotes: valid, rejectedQuotes: item.quotes.length - valid.length, fix: status === "enough" || status === "not_applicable" ? null : item.fix };
    });
    const out: ContentBaseline = { model: CONTENT_MODEL.model, facts };
    return { status: facts.some((f) => f.status === "unverified") ? "partial" : "done", output: out as unknown as JsonValue };
  },
};

// ---------------------------------------------------------------------------------------------------------------
// cc_answer_* (each AI, website only, no tools)
// ---------------------------------------------------------------------------------------------------------------

function answerStage(engine: EngineIndex): StageDefinition {
  const name = ENGINE_NAMES[engine];
  return {
    id: `cc_answer_${name.toLowerCase()}`,
    module: MODULE,
    label: `Clear & complete 3/4: ${name} answers from the website only`,
    inputs: ["cc_bundle"],
    timeoutMs: 180_000,
    maxAttempts: 2,
    autoRun: true,
    parseParams: () => ({}),
    output: contentAnswers,
    async run(ctx) {
      const b = input(ctx, "cc_bundle", contentBundle);
      const client = ctx.answerEngine(engine);
      const instruction = answerInstruction(b.business, { ...b.standard, noun: b.standard.noun ?? "business", approved: "", match: /x/ });
      const base = { engine, model: client?.model ?? ENGINE_MODELS[engine]!.model, instruction, answers: {}, replyExcerpt: "", servedModel: null };
      if (!client) return { status: "partial", output: { ...base, configured: false, status: "not_tested", reason: `${name} is not configured (its API key is not set)` } as unknown as JsonValue };
      if (!client.answerOffline) return { status: "partial", output: { ...base, configured: true, status: "not_tested", reason: `${name} has no website-only mode in this configuration` } as unknown as JsonValue };
      const request = { instruction, material: answerMaterial({ ...b.standard, noun: b.standard.noun ?? "business", approved: "", match: /x/ }, b.pages) };
      try {
        const r = await ctx.paidCall({ provider: client.provider, model: client.model, estimate: client.estimateOffline?.(request) ?? client.estimate({ question: request.material, location: null, maxSearches: 0 }) }, async (signal) => {
          const res = await client.answerOffline!(request, signal);
          return { result: res, usage: res.usage };
        });
        const answers = r.status === "ok" ? parseAnswers(r.text, b.standard.facts.map((f) => f.id)) : null;
        const out: ContentAnswers = {
          ...base,
          configured: true,
          servedModel: r.servedModel,
          status: r.status === "refused" ? "refused" : answers ? "ok" : "unreadable",
          reason: r.status === "refused" ? `${name} declined to answer` : answers ? null : "The reply wasn't in the requested format",
          answers: answers ?? {},
          replyExcerpt: r.text.slice(0, 4000),
        };
        return { status: out.status === "ok" ? "done" : "partial", output: out as unknown as JsonValue };
      } catch (e) {
        if (e instanceof SpendingCapError || e instanceof MissingPricingError) {
          return { status: "partial", output: { ...base, configured: true, status: "not_tested", reason: errorMessage(e) } as unknown as JsonValue };
        }
        throw e;
      }
    },
  };
}

const ANSWER_STAGES = ([0, 1, 2] as const).map(answerStage);
const ANSWER_IDS = ANSWER_STAGES.map((s) => s.id);

// ---------------------------------------------------------------------------------------------------------------
// cc_score (NOT STATED handled in plain code; the rest judged by one model call against the same pages)
// ---------------------------------------------------------------------------------------------------------------

export const ccScore: StageDefinition = {
  id: "cc_score",
  module: MODULE,
  label: "Clear & complete 4/4: score the answers",
  inputs: ["cc_bundle", "cc_baseline", ...ANSWER_IDS],
  timeoutMs: 180_000,
  maxAttempts: 2,
  autoRun: true,
  instructions: [scoreAnswers],
  parseParams: () => ({}),
  output: contentScore,
  async run(ctx) {
    const b = input(ctx, "cc_bundle", contentBundle);
    const base = input(ctx, "cc_baseline", contentBaseline);
    const ans = ANSWER_IDS.map((s) => input(ctx, s, contentAnswers));
    const site = new Map(base.facts.map((f) => [f.id, f]));

    type Cell = { answer: string | null; verdict: Verdict; reason: string; claim?: string | null; overruled?: string };
    const cells = new Map<string, Cell>();
    const toJudge: { engine: number; id: string; answer: string }[] = [];
    for (const a of ans)
      for (const f of b.standard.facts) {
        const key = `${a.engine}|${f.id}`;
        const status = site.get(f.id)?.status ?? "unverified";
        if (a.status !== "ok") {
          cells.set(key, { answer: null, verdict: "not_tested", reason: a.reason ?? "Not tested" });
          continue;
        }
        const answer = a.answers[f.id];
        if (isNotStated(answer)) {
          const v = notStatedVerdict(status);
          cells.set(key, { answer: answer ?? null, verdict: v, reason: v === "correctly_not_stated" ? "It said the website doesn't state this, which matches our assessment." : "It said the website doesn't state this, but the pages do." });
        } else toJudge.push({ engine: a.engine, id: f.id, answer: answer! });
      }

    if (toJudge.length) {
      const res = await ctx.llm({
        instruction: scoreAnswers,
        model: SCORING_MODEL,
        input: {
          facts: b.standard.facts.map((f) => ({ id: f.id, name: f.name, lookFor: f.lookFor, website: { status: site.get(f.id)?.status ?? "unverified", provides: site.get(f.id)?.provides ?? "", missing: site.get(f.id)?.missing ?? null } })),
          pages: b.pages.map((p) => ({ ref: p.ref, name: p.name, url: p.url, text: p.text })),
          answers: toJudge,
        },
        output: judged,
      });
      for (const j of toJudge) {
        const v = res.items.find((i) => i.engine === j.engine && i.id === j.id);
        if (!v) {
          cells.set(`${j.engine}|${j.id}`, { answer: j.answer, verdict: "not_tested", reason: "The scoring gave no verdict for this answer." });
          continue;
        }
        // A "wrong" / "unsupported" verdict stands only when the blamed words are in the answer and on none of the pages.
        if ((v.verdict === "wrong" || v.verdict === "unsupported") && !claimHolds(v.claim, j.answer, b.pages)) {
          cells.set(`${j.engine}|${j.id}`, { answer: j.answer, verdict: "supported", reason: "Matches the pages (the scorer's objection couldn't be confirmed against the pages).", claim: v.claim, overruled: v.verdict });
          continue;
        }
        cells.set(`${j.engine}|${j.id}`, { answer: j.answer, verdict: v.verdict, reason: v.verdict === "unsupported" && v.claim ? `Not on your pages: “${v.claim}”.` : v.reason, claim: v.claim });
      }
    }

    const out: ContentScore = {
      version: CONTENT_CHECK_VERSION,
      standard: { id: b.standard.id, version: b.standard.version, label: b.standard.label },
      business: b.business,
      pages: b.pages.map((p) => ({ ref: p.ref, url: p.url, name: p.name, words: p.words, truncated: p.truncated })),
      leftOut: b.leftOut,
      models: { assessor: base.model, scorer: SCORING_MODEL.model, engines: ans.map((a) => (a.status === "ok" ? (a.servedModel ?? a.model) : null)) },
      facts: b.standard.facts.map((f) => {
        const w = site.get(f.id)!;
        return {
          id: f.id,
          bucket: f.bucket,
          name: f.name,
          lookFor: f.lookFor,
          website: { status: w.status, provides: w.provides, missing: w.missing, quotes: w.quotes, fix: w.fix },
          answers: [0, 1, 2].map((e) => cells.get(`${e}|${f.id}`) ?? { answer: null, verdict: "not_tested" as Verdict, reason: "Not tested" }),
        };
      }),
    };
    return { status: ans.every((a) => a.status === "ok") ? "done" : "partial", output: out as unknown as JsonValue };
  },
};

export const CONTENT_STAGES = [ccBundle, ccBaseline, ...ANSWER_STAGES, ccScore] as const;
