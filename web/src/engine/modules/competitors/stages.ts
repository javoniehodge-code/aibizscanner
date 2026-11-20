import { z } from "zod";
import { errorMessage, MissingPricingError, SpendingCapError } from "../../errors";
import { LlmNotConfiguredError } from "../../llm";
import type { JsonValue, StageContext, StageDefinition } from "../../types";
import { cutWords } from "../content/logic";
import { websiteValues } from "../content/instructions/website-values";
import { contentBundle, SCORING_MODEL } from "../content/stages";
import { standardFor } from "../content/standards";
import { checkValues, checkedValue, comparableFacts, readValue } from "../content/values";
import { serviceLines, shownLines } from "../prompt-analysis/lines-stage";
import { promptSetSpec } from "../prompt-analysis/schemas";
import { assembledSection } from "../prompt-analysis/stages";
import { copyEntry, coverageMaps, evidenceEntry, competitorsPart } from "@/report/schema";
import { STANDARDS } from "../content/standards";
import { websiteValuesOutput } from "../content/stages";
import { webPresenceSection } from "../web-presence/section-stage";
import { answerReasons } from "./instructions/reasons";
import { buildCompetitors, competitorEvidence, COMPETITORS_EVIDENCE, COMPETITORS_READ_EVIDENCE } from "./logic/section";
import { competitorSite, COMPETITORS_VERSION, mainLine, pickCompetitors, rankBusinesses } from "./logic/pick";
import { readPage, type ReadPage } from "./logic/read";

const MODULE = "competitors";
/** Browser loads start only within this budget (the stage times out at 270 s). */
const BROWSER_BUDGET_MS = 180_000;
/** Words of each competitor page given to the reading. */
const MAX_WORDS = 3000;
/** Answers given to the reasons reading, per business. */
const MAX_ANSWERS = 12;

function input<T>(ctx: StageContext, stage: string, schema: z.ZodType<T>): T {
  const i = ctx.inputs[stage];
  if (!i) throw new Error(`Missing input ${stage}`);
  return schema.parse(i.output);
}

// ---------------------------------------------------------------------------------------------------------------
// cp_choice: the admin's choice of the two competitors (optional; saved from the prompts page)
// ---------------------------------------------------------------------------------------------------------------

/** Two names to compare with, or none to go back to the automatic choice. */
export const competitorChoice = z
  .object({ names: z.array(z.string().trim().min(1).max(120)).refine((n) => n.length === 0 || n.length === 2, "Give two names, or none for the automatic choice") })
  .strict();
export const cpChoice: StageDefinition = {
  id: "cp_choice",
  module: MODULE,
  label: "Competitors: the two businesses to compare (chosen by an admin)",
  inputs: [],
  timeoutMs: 10_000,
  maxAttempts: 1,
  parseParams: (raw) => competitorChoice.parse(raw) as unknown as Record<string, JsonValue>,
  output: competitorChoice,
  async run(ctx) {
    return { status: "done", output: competitorChoice.parse(ctx.params) as unknown as JsonValue };
  },
};

// ---------------------------------------------------------------------------------------------------------------
// cp_pages: pick the two competitors and read their own pages AI cited, plus their home page
// ---------------------------------------------------------------------------------------------------------------

const readPageSchema = z.object({ url: z.string(), state: z.enum(["checked", "unchecked"]), reason: z.string().nullable(), snapshotId: z.string().nullable(), title: z.string().nullable(), words: z.number().int(), mode: z.enum(["plain", "browser"]).nullable() }).strict();
export const competitorPages = z
  .object({
    version: z.string(),
    /** The service line compared (null: every question). */
    line: z.object({ name: z.string(), questions: z.array(z.string()) }).strict().nullable(),
    answers: z.number().int(),
    chosenBy: z.enum(["recommendations", "admin"]),
    target: z.object({ key: z.string(), name: z.string(), recommended: z.number().int(), named: z.number().int() }).strict(),
    competitors: z.array(
      z.object({ key: z.string(), name: z.string(), recommended: z.number().int(), named: z.number().int(), site: z.string().nullable(), pages: z.array(readPageSchema) }).strict(),
    ),
  })
  .strict();
export type CompetitorPages = z.infer<typeof competitorPages>;

export const cpPages: StageDefinition = {
  id: "cp_pages",
  module: MODULE,
  label: "Competitors 1/3: pick the two competitors and read their own pages",
  inputs: ["pa_prompt_set", "pa_assemble"],
  /** Service lines (the main line is compared) and the admin's choice of competitors, when saved. */
  optionalInputs: ["pa_lines", "cp_choice"],
  timeoutMs: 270_000,
  maxAttempts: 2,
  autoRun: true,
  parseParams: (raw) => {
    z.object({}).strict().parse(raw ?? {});
    return {};
  },
  output: competitorPages,
  async run(ctx) {
    const set = input(ctx, "pa_prompt_set", promptSetSpec);
    const pa = input(ctx, "pa_assemble", assembledSection);
    const linesIn = ctx.inputs.pa_lines;
    const lines = linesIn ? shownLines({ lines: serviceLines.parse(linesIn.output).lines.map((l) => ({ name: l.name, questions: l.questions.filter((q) => set.prompts.some((p) => p.id === q)) })) }) : null;
    const line = mainLine(lines);
    const chosen = ctx.inputs.cp_choice ? competitorChoice.parse(ctx.inputs.cp_choice.output).names : [];
    const choice = chosen.length ? chosen : null;
    const { ranked, answers } = rankBusinesses(pa.section, line);
    const targetKey = pa.business.key;
    const picked = pickCompetitors(ranked, pa.section.businesses, targetKey, choice);
    const t = ranked.find((r) => r.key === targetKey) ?? { key: targetKey, name: pa.business.name, recommended: 0, named: 0 };

    const robots = new Map();
    const started = Date.now();
    const competitors = [];
    for (const c of picked) {
      const site = competitorSite(pa.section, c);
      const pages: ReadPage[] = [];
      for (const url of site?.urls ?? []) pages.push(await readPage(ctx, url, robots, () => Date.now() - started < BROWSER_BUDGET_MS));
      competitors.push({ ...c, site: site?.site ?? null, pages });
    }
    const out: CompetitorPages = { version: COMPETITORS_VERSION, line: line && { name: line.name, questions: [...line.questions] }, answers, chosenBy: choice ? "admin" : "recommendations", target: t, competitors };
    return { status: "done", output: out as unknown as JsonValue };
  },
};

// ---------------------------------------------------------------------------------------------------------------
// cp_assess: each competitor's facts as values, and the reasons and concerns AI answers give for each business
// ---------------------------------------------------------------------------------------------------------------

const item = z.object({ title: z.string(), detail: z.string(), ref: z.string(), quote: z.string() }).strict();
const reasonsReply = z.object({ reasons: z.array(item), concerns: z.array(item) }).strict();
const checkedItem = z.object({ title: z.string(), detail: z.string(), quote: z.string() }).strict();
export const competitorAssessment = z
  .object({
    version: z.string(),
    model: z.string(),
    standard: z.string().nullable(),
    fromRun: z.string(),
    values: z.array(z.object({ key: z.string(), values: z.array(checkedValue), dropped: z.array(z.string()), error: z.string().nullable() }).strict()),
    /** The business first, then the two competitors. */
    reasons: z.array(z.object({ key: z.string(), reasons: z.array(checkedItem), concerns: z.array(checkedItem), dropped: z.number().int(), error: z.string().nullable() }).strict()),
  })
  .strict();
export type CompetitorAssessment = z.infer<typeof competitorAssessment>;

const norm = (s: string) => s.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
/** The quote is in the answer word for word (letters and digits), with at least four words. */
const inAnswer = (quote: string, answer: string) => {
  const q = norm(quote.replace(/\.{3}|…/g, " "));
  return q.split(" ").filter(Boolean).length >= 4 && ` ${norm(answer)} `.includes(` ${q} `);
};

export const cpAssess: StageDefinition = {
  id: "cp_assess",
  module: MODULE,
  label: "Competitors 2/3: read their facts, and why AI recommends each business",
  inputs: ["pa_prompt_set", "pa_assemble", "cp_pages"],
  /** The fact standard chosen for the website check, when it has run (else the category's standard). */
  optionalInputs: ["cc_bundle"],
  timeoutMs: 240_000,
  maxAttempts: 2,
  autoRun: true,
  instructions: [websiteValues, answerReasons],
  parseParams: (raw) => {
    z.object({}).strict().parse(raw ?? {});
    return {};
  },
  output: competitorAssessment,
  async run(ctx) {
    const set = input(ctx, "pa_prompt_set", promptSetSpec);
    const pa = input(ctx, "pa_assemble", assembledSection);
    const cp = input(ctx, "cp_pages", competitorPages);
    const bundle = ctx.inputs.cc_bundle ? contentBundle.parse(ctx.inputs.cc_bundle.output) : null;
    const standard = bundle?.standard ?? standardFor(set.target.category);
    const facts = standard ? comparableFacts(standard) : [];
    let stop: string | null = null;
    const guard = async <T>(fn: () => Promise<T>): Promise<{ ok: T } | { error: string }> => {
      if (stop) return { error: stop };
      try {
        return { ok: await fn() };
      } catch (e) {
        const msg = errorMessage(e);
        if (e instanceof SpendingCapError || e instanceof MissingPricingError || e instanceof LlmNotConfiguredError) stop = msg;
        return { error: msg };
      }
    };

    // Each competitor's facts, read the same way as the business's own website (content/website-values).
    const values = [];
    for (const c of cp.competitors) {
      const read = c.pages.filter((p) => p.state === "checked" && p.snapshotId);
      const texts = await ctx.snapshotTexts(read.map((p) => p.snapshotId!));
      const pages = read.flatMap((p, i) => {
        const t = texts.get(p.snapshotId!);
        return t ? [{ ref: `C${i + 1}`, name: p.title ?? p.url, url: p.url, text: cutWords(t, MAX_WORDS).text }] : [];
      });
      if (!pages.length || !facts.length) {
        values.push({ key: c.key, values: [], dropped: [], error: pages.length ? null : "No page of its website could be read" });
        continue;
      }
      const r = await guard(() => ctx.llm({ instruction: websiteValues, model: SCORING_MODEL, input: { business: { name: c.name, location: set.target.location, category: set.target.category }, facts, pages }, output: z.object({ values: z.array(readValue) }).strict() }));
      if ("error" in r) values.push({ key: c.key, values: [], dropped: [], error: r.error });
      else {
        const checked = checkValues(r.ok.values, standard!.id, (v) => pages.find((p) => p.ref === v.ref)?.text ?? null);
        values.push({ key: c.key, values: checked.values, dropped: checked.dropped, error: null });
      }
    }

    // Why the line's answers recommend each business, and what they hold against it; quotes checked in the answer.
    const lineQs = cp.line?.questions;
    const answersFor = (key: string) =>
      pa.section.questions
        .filter((q) => !lineQs || lineQs.includes(q.question.v.id))
        .flatMap((q) => q.answers.flatMap((a) => (a.v.status === "ok" && a.v.named.some((n) => n.business === key) ? [a.v.text] : [])))
        .slice(0, MAX_ANSWERS)
        .map((text, i) => ({ ref: `A${i + 1}`, text }));
    const reasons = [];
    for (const b of [cp.target, ...cp.competitors]) {
      const answers = answersFor(b.key);
      if (!answers.length) {
        reasons.push({ key: b.key, reasons: [], concerns: [], dropped: 0, error: null });
        continue;
      }
      const r = await guard(() => ctx.llm({ instruction: answerReasons, model: SCORING_MODEL, input: { business: b.name, answers }, output: reasonsReply }));
      if ("error" in r) {
        reasons.push({ key: b.key, reasons: [], concerns: [], dropped: 0, error: r.error });
        continue;
      }
      const keep = (xs: z.infer<typeof item>[]) => xs.filter((x) => inAnswer(x.quote, answers.find((a) => a.ref === x.ref)?.text ?? "")).slice(0, 3).map((x) => ({ title: x.title.trim(), detail: x.detail.trim(), quote: x.quote.trim() }));
      const rs = keep(r.ok.reasons);
      const cs = keep(r.ok.concerns);
      reasons.push({ key: b.key, reasons: rs, concerns: cs, dropped: r.ok.reasons.length + r.ok.concerns.length - rs.length - cs.length, error: null });
    }

    const out: CompetitorAssessment = { version: COMPETITORS_VERSION, model: SCORING_MODEL.model, standard: standard?.id ?? null, fromRun: ctx.inputs.cp_pages!.runId, values, reasons };
    const failed = values.some((v) => v.error && v.error !== "No page of its website could be read") || reasons.some((r) => r.error);
    return { status: failed ? "partial" : "done", output: out as unknown as JsonValue };
  },
};

// ---------------------------------------------------------------------------------------------------------------
// cp_section: the competitor comparison part (plain code), read by report_assemble
// ---------------------------------------------------------------------------------------------------------------

export const competitorSection = z
  .object({
    competitors: competitorsPart.nullable(),
    evidence: z.record(z.string(), evidenceEntry),
    copy: z.object({ competitorScope: copyEntry }).strict(),
  })
  .strict();
export type CompetitorSection = z.infer<typeof competitorSection>;

export const cpSection: StageDefinition = {
  id: "cp_section",
  module: MODULE,
  label: "Competitors 3/3: build the comparison",
  inputs: ["pa_prompt_set", "cp_pages", "cp_assess"],
  /** The business's own values and the citation coverage maps, when they have run. */
  optionalInputs: ["cc_values", "wp_section"],
  timeoutMs: 20_000,
  maxAttempts: 1,
  autoRun: true,
  parseParams: () => ({}),
  output: competitorSection,
  async run(ctx) {
    const set = input(ctx, "pa_prompt_set", promptSetSpec);
    const withRun = <T>(stage: string, schema: z.ZodType<T>) => {
      const i = ctx.inputs[stage];
      return i ? { ...schema.parse(i.output), runId: i.runId, finishedAt: i.finishedAt ?? new Date().toISOString() } : null;
    };
    const pages = withRun("cp_pages", competitorPages)!;
    const assessed = withRun("cp_assess", competitorAssessment)!;
    // Readings of an earlier cp_pages run don't describe these competitors: wait for cp_assess to read this run.
    if (assessed.fromRun !== pages.runId) return { status: "done", output: { competitors: null, evidence: {}, copy: { competitorScope: { v: null, p: { kind: "missing", reason: "The competitors' pages are being read again" } } } } as unknown as JsonValue };
    const standard = STANDARDS.find((s) => s.id === (assessed.standard ?? "")) ?? standardFor(set.target.category);
    const wv = ctx.inputs.cc_values ? websiteValuesOutput.parse(ctx.inputs.cc_values.output) : null;
    const wp = ctx.inputs.wp_section ? webPresenceSection.parse(ctx.inputs.wp_section.output) : null;
    const maps = coverageMaps(wp?.citationCoverage);
    const coverage = (pages.line ? maps.find((m) => m.line?.v.name === pages.line!.name) : maps[0]) ?? null;
    const built = standard ? buildCompetitors({ standard, pages, assessed, website: wv?.values ?? null, coverage }) : null;
    const ev = [COMPETITORS_EVIDENCE, COMPETITORS_READ_EVIDENCE];
    const out: CompetitorSection = {
      competitors: built && { compared: built.compared, summary: built.summary, rows: built.rows, reasons: built.reasons, concerns: built.concerns, cards: built.cards, questions: pages.line ? { v: pages.line.questions, p: { kind: "observed", evidence: ev } } : undefined } as never,
      evidence: built ? competitorEvidence({ standard: standard!, pages, assessed, website: null, coverage: null }) : {},
      copy: { competitorScope: built ? { v: built.scope, p: { kind: "observed", evidence: ev } } : { v: null, p: { kind: "missing" as const, reason: "Fewer than two competitors were found" } } },
    };
    return { status: "done", output: out as unknown as JsonValue };
  },
};

export const COMPETITOR_STAGES = [cpChoice, cpPages, cpAssess, cpSection] as const;
