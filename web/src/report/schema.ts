import { z } from "zod";

/**
 * Report document: the single JSON the Full Business Diagnostic template renders from
 * (design/reports/full-business-diagnostic.dc.html). Brief §4 "Report data contract".
 *
 * Provenance rule: every value sits inside exactly one envelope `{ v, p }`. Envelopes are placed at the smallest unit
 * that comes from one piece of evidence (an answer, a table row, a card), so all fields of a record share it.
 * `p` is one of:
 *   - observed: seen in stored evidence; `evidence` lists ids from the document's `evidence` registry
 *   - assumed:  a labeled assumption; `rule` states it
 *   - sample:   illustrative data, not from a real run
 *   - missing:  not available; `reason` says why, and `v` is null
 * Only envelopes declared with `maybe()` may be missing; the template has an explicit state for each of them.
 */

export const SCHEMA_VERSION = "1.0";

// ---------------------------------------------------------------------------------------------------------------
// Provenance envelopes
// ---------------------------------------------------------------------------------------------------------------

const nonEmpty = z.string().trim().min(1);

export const observedProvenance = z.object({ kind: z.literal("observed"), evidence: z.array(nonEmpty).min(1) }).strict();
export const assumedProvenance = z.object({ kind: z.literal("assumed"), rule: nonEmpty }).strict();
export const sampleProvenance = z.object({ kind: z.literal("sample"), note: nonEmpty.optional() }).strict();
export const missingProvenance = z.object({ kind: z.literal("missing"), reason: nonEmpty }).strict().meta({ id: "MissingProvenance" });

export const presentProvenance = z
  .discriminatedUnion("kind", [observedProvenance, assumedProvenance, sampleProvenance])
  .meta({ id: "PresentProvenance", description: "Provenance of a value that is present: observed, assumed or sample." });
export const provenance = z.discriminatedUnion("kind", [observedProvenance, assumedProvenance, sampleProvenance, missingProvenance]);
export type Provenance = z.infer<typeof provenance>;

/** A value that must be present. */
export function val<T extends z.ZodType>(inner: T) {
  return z.object({ v: inner, p: presentProvenance }).strict();
}

/** A value that may be marked missing (then `v` is null and the template shows its missing state). */
export function maybe<T extends z.ZodType>(inner: T) {
  return z.union([val(inner), z.object({ v: z.null(), p: missingProvenance }).strict()]);
}

// ---------------------------------------------------------------------------------------------------------------
// Shared value types
// ---------------------------------------------------------------------------------------------------------------

/** Engine index into `engines`: 0 ChatGPT, 1 Claude, 2 Gemini (v1 scope, brief §2). */
const engineIndex = z.number().int().min(0).max(2);
const businessKey = z.string().regex(/^[A-Z][A-Z0-9]{1,5}$/, "Business keys are short upper-case codes, e.g. BM");
const pageKey = z.string().regex(/^[a-z]{2}\d*$/, "Cited page keys look like rv1, dr2, yw");
const kv = z.object({ k: nonEmpty, v: nonEmpty }).strict();
const text = z.string();
/** Placeholders the template fills from promptAnalysis.run: {prompts}, {usable}, {expected}. */
const copyText = z.string().refine((s) => [...s.matchAll(/\{(\w+)\}/g)].every((m) => ["prompts", "usable", "expected"].includes(m[1] ?? "")), {
  message: "Only {prompts}, {usable} and {expected} placeholders are supported",
});
/** One value per engine, in engine order. */
const three = <T extends z.ZodType>(t: T) => z.tuple([t, t, t]);
const slideTarget = z.string().regex(/^[bpx]\d+$/, "Slide targets look like b7 (website part), p1 (prompt part), x3 (cover)");

// ---------------------------------------------------------------------------------------------------------------
// Prompt analysis (AI Recommendation section)
// ---------------------------------------------------------------------------------------------------------------

export const pageCategory = z.enum(["your", "other", "maps", "review", "dir", "ed", "comm", "off", "unc"]);

const answer = z.discriminatedUnion("status", [
  z
    .object({
      status: z.literal("ok"),
      /** Businesses named, in order of appearance. R recommended, M mentioned only, X explicitly excluded. */
      named: z.array(z.object({ business: businessKey, status: z.enum(["R", "M", "X"]) }).strict()),
      /** Cited pages (keys into promptAnalysis.pages). */
      citations: z.array(pageKey),
      /** Sources the answer names without citing them. Never counted as citations (brief §7). */
      uncitedMentions: z.array(z.object({ source: nonEmpty, text: nonEmpty, page: pageKey.nullable() }).strict()),
      text: nonEmpty,
      /** What the answer says about the target business, quoted. */
      statedReason: z.string().nullable(),
      /** Businesses are grouped with no clear order. */
      grouped: z.boolean(),
      /** Web search requested and observed in the response. */
      searchObserved: z.boolean(),
      runAt: nonEmpty,
    })
    .strict(),
  z.object({ status: z.literal("unavailable"), reason: nonEmpty, runAt: nonEmpty }).strict(),
]);
export type Answer = z.infer<typeof answer>;

const promptAnalysis = z
  .object({
    groups: z.array(val(z.object({ name: nonEmpty, description: nonEmpty }).strict())).min(1),
    businesses: z.array(val(z.object({ key: businessKey, name: nonEmpty }).strict())).min(1),
    pages: z.array(val(z.object({ key: pageKey, url: nonEmpty, category: pageCategory }).strict())),
    questions: z
      .array(
        z
          .object({
            question: val(
              z
                .object({ id: z.string().regex(/^P\d+$/), group: z.number().int().min(0), demand: nonEmpty, text: nonEmpty })
                .strict(),
            ),
            /** One answer slot per engine, in engine order. */
            answers: three(val(answer)),
          })
          .strict(),
      )
      .min(1),
    /** Explicit first choices: a stated preference, not list position. */
    firstChoices: z.array(
      val(
        z
          .object({ prompt: z.string().regex(/^P\d+$/), engine: engineIndex, business: businessKey, scope: nonEmpty, excerpt: nonEmpty })
          .strict(),
      ),
    ),
    /** Local business: Gemini is assumed to draw on Google Maps / Business Profile for every answer. */
    localAssumption: maybe(z.boolean()),
    uncitedSources: maybe(
      z.array(
        z
          .object({
            key: nonEmpty,
            name: nonEmpty,
            site: nonEmpty,
            named: nonEmpty,
            /** Engine assumed to use this source on every answer (the local-business assumption), if any. */
            assumedEngine: engineIndex.nullable(),
            presentBusinesses: z.array(businessKey),
          })
          .strict(),
      ),
    ),
    /** Completeness of the engine run, as recorded by the run (cross-checked against the answers). */
    run: maybe(
      z
        .object({
          prompts: z.number().int().min(0),
          expected: z.number().int().min(0),
          usable: z.number().int().min(0),
          unavailable: z.number().int().min(0),
          gaps: z.string(),
        })
        .strict(),
    ),
    method: z.array(val(z.object({ title: nonEmpty, text: nonEmpty }).strict())),
    whyCards: z.array(val(z.object({ engine: engineIndex, heading: nonEmpty, text: nonEmpty, sources: nonEmpty }).strict())),
  })
  .strict();

// ---------------------------------------------------------------------------------------------------------------
// Competitors, citation coverage, web presence map
// ---------------------------------------------------------------------------------------------------------------

const comparisonCell = z.object({ value: nonEmpty, sub: z.string(), mark: z.enum(["g", "r", "k"]).nullable() }).strict();
const competitors = z
  .object({
    /** The two other businesses compared with the target (keys into promptAnalysis.businesses). */
    compared: val(z.tuple([businessKey, businessKey])),
    summary: val(nonEmpty),
    /** Comparison rows after the computed "Recommended by AI" row. Cells: target, then the two competitors. */
    rows: z.array(val(z.object({ name: nonEmpty, sub: nonEmpty, cells: z.tuple([comparisonCell, comparisonCell, comparisonCell]) }).strict())),
    reasons: three(val(z.array(z.object({ title: nonEmpty, detail: nonEmpty }).strict()))),
    concerns: three(val(z.array(z.object({ title: nonEmpty, detail: nonEmpty }).strict()))),
    cards: z.array(val(z.object({ kind: nonEmpty, heading: nonEmpty, text: nonEmpty, link: nonEmpty, target: slideTarget, dark: z.boolean() }).strict())),
  })
  .strict();

const citationCoverage = z
  .object({
    sites: z.array(val(z.object({ name: nonEmpty, type: nonEmpty, pageKeys: z.array(pageKey).min(1), presentBusinesses: z.array(businessKey) }).strict())),
    /** Businesses shown as columns (target first is enforced by the template). */
    businesses: val(z.array(businessKey).min(1)),
  })
  .strict();

const wpmMark = z.enum(["P", "L", "C", "N", "U", "A"]);
const wpmDetail = z.object({ says: nonEmpty, excerpt: z.string(), url: z.string(), issue: z.string(), action: z.string() }).strict();
const webPresence = z.array(
  val(
    z
      .object({
        name: nonEmpty,
        domain: nonEmpty,
        type: nonEmpty,
        /** Empty for sources we found ourselves (not cited in answers). */
        pageKeys: z.array(pageKey),
        pagesChecked: z.number().int().min(0),
        pagesFailed: z.number().int().min(0),
        /** Business details, Services, Customer fit, Reviews, Recommendations, Locations. */
        marks: z.tuple([wpmMark, wpmMark, wpmMark, wpmMark, wpmMark, wpmMark]),
        details: z.partialRecord(z.enum(["0", "1", "2", "3", "4", "5"]), wpmDetail),
      })
      .strict(),
  ),
);

// ---------------------------------------------------------------------------------------------------------------
// Website section
// ---------------------------------------------------------------------------------------------------------------

const discovery = z
  .object({
    /** Per engine: published site rules (robots.txt) for its crawlers. */
    permissions: three(val(z.object({ mark: z.enum(["g", "d", "r"]), label: nonEmpty, searchAccess: nonEmpty }).strict())),
    pageGroups: z
      .array(
        z
          .object({
            group: val(z.object({ title: nonEmpty, description: nonEmpty }).strict()),
            pages: z
              .array(
                z
                  .object({
                    page: val(z.object({ name: nonEmpty, url: nonEmpty, why: nonEmpty }).strict()),
                    /** Per engine. search: g found, k link only, r not found, d not tested. read: g read, p partly, f failed. */
                    results: three(val(z.object({ search: z.enum(["g", "k", "r", "d"]), read: z.enum(["g", "p", "f"]) }).strict())),
                  })
                  .strict(),
              )
              .min(1),
          })
          .strict(),
      )
      .min(1),
    notes: z.array(val(z.object({ page: nonEmpty, engine: engineIndex, text: nonEmpty }).strict())),
    /** Our raw-HTML vs fully-loaded diagnostic (not an AI's own test). */
    rawVsLoaded: maybe(z.array(z.object({ page: nonEmpty, raw: nonEmpty, loaded: nonEmpty, mark: z.enum(["g", "k", "r"]), result: nonEmpty }).strict())),
    attention: z.array(val(z.object({ title: nonEmpty, engines: z.array(engineIndex), what: nonEmpty, next: nonEmpty, technical: nonEmpty }).strict())),
    how: z.array(val(kv)),
  })
  .strict();

const structuredData = z
  .object({
    stats: z.array(val(z.object({ value: nonEmpty, label: nonEmpty }).strict())),
    problems: z.array(val(z.object({ mark: z.enum(["r", "k"]), tag: nonEmpty, title: nonEmpty, why: nonEmpty, details: z.array(kv) }).strict())),
    facts: z.array(val(z.object({ fact: nonEmpty, page: nonEmpty, code: nonEmpty, mark: z.enum(["g", "r", "k"]) }).strict())),
  })
  .strict();

const clearCell = z.object({ mark: z.enum(["g", "k", "r", "n"]).nullable(), value: nonEmpty, sub: z.string() }).strict();
const clear = z
  .object({
    intro: val(nonEmpty),
    verdict: val(z.object({ heading: nonEmpty, text: nonEmpty }).strict()),
    /** "Facts given in full" row: counts are computed from `facts`; these are the notes under them. */
    summary: val(z.object({ sub: nonEmpty, notes: z.tuple([text, text, text, text]) }).strict()),
    /** Cells: your website (baseline), then ChatGPT, Claude, Gemini. */
    facts: z.array(val(z.object({ name: nonEmpty, sub: nonEmpty, cells: z.tuple([clearCell, clearCell, clearCell, clearCell]) }).strict())).min(1),
    fixes: z.array(val(z.object({ title: nonEmpty, text: nonEmpty, closes: nonEmpty, example: z.string() }).strict())),
    rules: z.array(val(kv)),
  })
  .strict();

const consistent = z
  .object({
    intro: val(nonEmpty),
    verdict: val(z.object({ heading: nonEmpty, text: nonEmpty }).strict()),
    sources: z.array(val(z.object({ name: nonEmpty, sub: nonEmpty }).strict())).min(1),
    facts: z.array(
      val(
        z
          .object({
            name: nonEmpty,
            website: z.object({ value: nonEmpty, pages: z.string().nullable(), issue: z.string().nullable() }).strict(),
            /** One per source, in `sources` order. g matches, r differs, n not listed. */
            sources: z.array(z.object({ text: nonEmpty, mark: z.enum(["g", "r", "n"]) }).strict()),
            /** a agree, c conflicting, o outdated elsewhere, u not enough to confirm. */
            status: z.enum(["a", "c", "o", "u"]),
            means: nonEmpty,
            note: z.string().nullable(),
          })
          .strict(),
      ),
    ),
    fixes: z.array(val(z.object({ title: nonEmpty, where: nonEmpty, why: nonEmpty }).strict())),
    rules: z.array(val(kv)),
  })
  .strict();

const distinctive = z
  .object({
    /** One-sentence description of the business from each engine, website only. */
    descriptions: three(val(nonEmpty)),
    questions: z.array(
      z
        .object({
          question: val(nonEmpty),
          answers: three(val(z.object({ text: nonEmpty, flag: z.string().nullable() }).strict())),
        })
        .strict(),
    ),
    takeaways: z.array(val(kv)),
    fixes: z.array(val(z.object({ title: nonEmpty, text: nonEmpty }).strict())),
  })
  .strict();

// ---------------------------------------------------------------------------------------------------------------
// Credible & corroborated (web presence)
// ---------------------------------------------------------------------------------------------------------------

const credible = z
  .object({
    intro: val(nonEmpty),
    standout: val(nonEmpty),
    /** Bars: answers citing a page of this kind where you appear (present) vs only pages without you (absent). */
    categories: z.array(val(z.object({ name: nonEmpty, note: nonEmpty, present: z.number().int().min(0), absent: z.number().int().min(0) }).strict())),
    takeaway: val(nonEmpty),
    /** The two web diagrams are generated from this; citation counts come from promptAnalysis answers. */
    web: z
      .object({
        categories: z.array(val(z.object({ label: nonEmpty, pageCategory }).strict())).min(1),
        sites: z.array(
          val(
            z
              .object({
                name: nonEmpty,
                pageCategory,
                pageKeys: z.array(pageKey).min(1),
                present: z.boolean(),
                quality: z.enum(["good", "named", "concern"]).nullable(),
                qualityLabel: z.string().nullable(),
              })
              .strict()
              .refine((s) => s.present === (s.quality !== null && s.qualityLabel !== null), {
                message: "Sites where the business appears need a mention quality and label; others must have none",
              }),
          ),
        ),
      })
      .strict(),
    pages: z.array(
      val(
        z
          .object({
            title: nonEmpty,
            type: nonEmpty,
            url: nonEmpty,
            prompts: z.number().int().min(0),
            engines: z.array(engineIndex),
            presence: z.enum(["rec", "rev", "list", "mixed", "none"]),
            detail: nonEmpty,
            supports: nonEmpty,
            prompt: nonEmpty,
          })
          .strict(),
      ),
    ),
    reviews: z.array(
      val(
        z
          .object({
            label: nonEmpty,
            title: nonEmpty,
            rating: nonEmpty,
            /** null: the profile shows no review count. */
            count: z.string().nullable(),
            recent: nonEmpty,
            themes: nonEmpty,
            cited: z.boolean(),
            /** Top of the rating scale; null when the profile doesn't show one (e.g. a bare "9.5"). */
            scale: z.number().positive().nullable(),
          })
          .strict(),
      ),
    ),
    fixes: z.array(val(z.object({ title: nonEmpty, text: nonEmpty }).strict())),
    rules: z.array(val(kv)),
  })
  .strict();

// ---------------------------------------------------------------------------------------------------------------
// Document
// ---------------------------------------------------------------------------------------------------------------

export const COPY_KEYS = [
  "websiteSummary",
  "discoveryIntro",
  "discoveryWhyPages",
  "clearPagesChecked",
  "clearStandard",
  "clearFoot",
  "consistentFoot",
  "credibleFoot",
  "groupLegend",
  "competitorKicker",
  "competitorTitle",
  "competitorIntro",
  "competitorReasonsIntro",
  "competitorConcernsIntro",
  "citedPagesTitle",
  "citedPagesIntro",
  "reportDetails",
  "promptReportDetails",
] as const;

const copy = z.object(Object.fromEntries(COPY_KEYS.map((k) => [k, maybe(copyText)])) as Record<(typeof COPY_KEYS)[number], ReturnType<typeof maybe<typeof copyText>>>).strict();

const evidenceEntry = z
  .object({
    source: nonEmpty,
    ref: nonEmpty,
    capturedOn: z.iso.date(),
    note: z.string().optional(),
  })
  .strict();

const reportShape = z
  .object({
    schemaVersion: z.literal(SCHEMA_VERSION),
    /** Where this document came from (not a report value). */
    fixture: z.object({ id: nonEmpty, title: nonEmpty, source: nonEmpty, note: nonEmpty }).strict().optional(),
    /** Evidence registry referenced by observed provenance. Pipeline-produced reports point at stored evidence rows. */
    evidence: z.record(nonEmpty, evidenceEntry),
    meta: val(z.object({ runDate: nonEmpty, language: nonEmpty }).strict()),
    business: val(z.object({ key: businessKey, name: nonEmpty, location: nonEmpty, domain: nonEmpty }).strict()),
    engines: z.tuple([
      val(z.object({ name: z.literal("ChatGPT"), model: nonEmpty }).strict()),
      val(z.object({ name: z.literal("Claude"), model: nonEmpty }).strict()),
      val(z.object({ name: z.literal("Gemini"), model: nonEmpty }).strict()),
    ]),
    copy,
    summary: z.object({ clear: val(z.object({ text: nonEmpty }).strict()) }).strict(),
    promptAnalysis,
    competitors,
    citationCoverage,
    webPresence,
    website: z.object({ discovery, structuredData, clear, consistent, distinctive }).strict(),
    credible,
    actions: z
      .object({
        tasks: z.array(
          val(z.object({ title: nonEmpty, kind: nonEmpty, scope: nonEmpty, engines: z.array(engineIndex), rows: z.array(kv) }).strict()),
        ),
        cases: z.array(
          val(z.object({ title: nonEmpty, finding: nonEmpty, work: nonEmpty, owner: nonEmpty, tasks: z.array(z.number().int().min(0)) }).strict()),
        ),
      })
      .strict(),
    methodGroups: z.array(val(z.object({ heading: nonEmpty, items: z.array(z.object({ title: nonEmpty, text: nonEmpty }).strict()) }).strict())),
  })
  .strict();

type Shape = z.infer<typeof reportShape>;

/** Walks every envelope in a document. */
export function forEachEnvelope(doc: unknown, fn: (env: { v: unknown; p: Provenance }, path: string) => void, path = "$"): void {
  if (Array.isArray(doc)) {
    doc.forEach((x, i) => forEachEnvelope(x, fn, `${path}[${i}]`));
    return;
  }
  if (doc && typeof doc === "object") {
    const o = doc as Record<string, unknown>;
    const keys = Object.keys(o);
    if (keys.length === 2 && "v" in o && "p" in o && o.p && typeof o.p === "object" && "kind" in (o.p as object)) {
      fn(o as { v: unknown; p: Provenance }, path);
      forEachEnvelope(o.v, fn, `${path}.v`);
      return;
    }
    for (const k of keys) forEachEnvelope(o[k], fn, `${path}.${k}`);
  }
}

/** Cross-references the shape alone can't express. */
function checkReferences(doc: Shape, ctx: z.RefinementCtx) {
  const issue = (message: string, path: (string | number)[]) => ctx.addIssue({ code: "custom", message, path });
  const pa = doc.promptAnalysis;
  const bizKeys = new Set(pa.businesses.map((b) => b.v.key));
  const pageKeys = new Set(pa.pages.map((p) => p.v.key));
  const promptIds = new Set(pa.questions.map((q) => q.question.v.id));

  forEachEnvelope(doc, (env, path) => {
    if (env.p.kind === "observed") for (const id of env.p.evidence) if (!doc.evidence[id]) issue(`Unknown evidence id "${id}" at ${path}`, ["evidence"]);
  });
  if (!bizKeys.has(doc.business.v.key)) issue("business.key must be one of promptAnalysis.businesses", ["business"]);

  pa.questions.forEach((q, qi) => {
    if (q.question.v.group >= pa.groups.length) issue("Question group out of range", ["promptAnalysis", "questions", qi]);
    q.answers.forEach((a, ai) => {
      if (a.v.status !== "ok") return;
      for (const n of a.v.named) if (!bizKeys.has(n.business)) issue(`Unknown business ${n.business}`, ["promptAnalysis", "questions", qi, "answers", ai]);
      for (const c of a.v.citations) if (!pageKeys.has(c)) issue(`Unknown cited page ${c}`, ["promptAnalysis", "questions", qi, "answers", ai]);
      for (const m of a.v.uncitedMentions) if (m.page && !pageKeys.has(m.page)) issue(`Unknown page ${m.page}`, ["promptAnalysis", "questions", qi, "answers", ai]);
    });
  });
  pa.firstChoices.forEach((f, i) => {
    if (!promptIds.has(f.v.prompt)) issue(`Unknown prompt ${f.v.prompt}`, ["promptAnalysis", "firstChoices", i]);
    if (!bizKeys.has(f.v.business)) issue(`Unknown business ${f.v.business}`, ["promptAnalysis", "firstChoices", i]);
  });
  if (pa.run.v) {
    const all = pa.questions.flatMap((q) => q.answers);
    const usable = all.filter((a) => a.v.status === "ok").length;
    const want = { prompts: pa.questions.length, expected: all.length, usable, unavailable: all.length - usable };
    for (const [k, n] of Object.entries(want)) {
      if (pa.run.v[k as keyof typeof want] !== n) issue(`run.${k} is ${pa.run.v[k as keyof typeof want]} but the answers give ${n}`, ["promptAnalysis", "run"]);
    }
  }
  for (const k of doc.competitors.compared.v) if (!bizKeys.has(k)) issue(`Unknown business ${k}`, ["competitors", "compared"]);
  for (const k of doc.citationCoverage.businesses.v) if (!bizKeys.has(k)) issue(`Unknown business ${k}`, ["citationCoverage", "businesses"]);
  doc.citationCoverage.sites.forEach((s, i) => {
    for (const k of s.v.pageKeys) if (!pageKeys.has(k)) issue(`Unknown page ${k}`, ["citationCoverage", "sites", i]);
    for (const k of s.v.presentBusinesses) if (!bizKeys.has(k)) issue(`Unknown business ${k}`, ["citationCoverage", "sites", i]);
  });
  doc.webPresence.forEach((w, i) => {
    for (const k of w.v.pageKeys) if (!pageKeys.has(k)) issue(`Unknown page ${k}`, ["webPresence", i]);
  });
  const webCats = new Set(doc.credible.web.categories.map((c) => c.v.pageCategory));
  doc.credible.web.sites.forEach((s, i) => {
    if (!webCats.has(s.v.pageCategory)) issue(`Site category ${s.v.pageCategory} has no diagram category`, ["credible", "web", "sites", i]);
    for (const k of s.v.pageKeys) if (!pageKeys.has(k)) issue(`Unknown page ${k}`, ["credible", "web", "sites", i]);
  });
  const nSources = doc.website.consistent.sources.length;
  doc.website.consistent.facts.forEach((f, i) => {
    if (f.v.sources.length !== nSources) issue(`Fact has ${f.v.sources.length} source cells; expected ${nSources}`, ["website", "consistent", "facts", i]);
  });
  doc.actions.cases.forEach((c, i) => {
    for (const t of c.v.tasks) if (t >= doc.actions.tasks.length) issue(`Task ${t} out of range`, ["actions", "cases", i]);
  });
}

export const reportDocument = reportShape.superRefine(checkReferences);
export type ReportDocument = z.infer<typeof reportDocument>;

/** Recursively replaces envelopes with their values (missing values become null). This is what the template renders. */
export function stripProvenance(doc: unknown): unknown {
  if (Array.isArray(doc)) return doc.map(stripProvenance);
  if (doc && typeof doc === "object") {
    const o = doc as Record<string, unknown>;
    const keys = Object.keys(o);
    if (keys.length === 2 && "v" in o && "p" in o && o.p && typeof o.p === "object" && "kind" in (o.p as object)) return stripProvenance(o.v);
    return Object.fromEntries(keys.map((k) => [k, stripProvenance(o[k])]));
  }
  return doc;
}
