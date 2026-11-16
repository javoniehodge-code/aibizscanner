import { z } from "zod";
import { MissingPricingError, SpendingCapError, errorMessage } from "../../errors";
import { LlmNotConfiguredError } from "../../llm";
import type { JsonValue, StageContext, StageDefinition } from "../../types";
import { classifySource } from "./instructions/classify-source";
import {
  bareDomains,
  categoryOf,
  checkModelClassification,
  citationEvidence,
  pageKeyOf,
  ruleGroup,
  siteKeyOf,
  type PageEvidence,
  type SiteOwner,
  type SourceGroup,
} from "./logic/sources";
import { EXTRACTION_MODEL } from "./models";
import { classifiedSources, engineAnswers, promptSetSpec, sourceVerdicts, type ClassifiedPage, type ClassifiedSources } from "./schemas";

const MODULE = "prompt-analysis";
const ANSWER_STAGES = ["pa_answers_chatgpt", "pa_answers_claude", "pa_answers_gemini"] as const;
/** Pages per classifier call, and calls in flight. */
const BATCH = 20;
const CONCURRENCY = 3;
/** Cache key for model verdicts: instruction version and model. */
export const CLASSIFIER_VERSION = `${classifySource.id}@v${classifySource.version}/${EXTRACTION_MODEL.model}`;

function input<T>(ctx: StageContext, stage: string, schema: z.ZodType<T>): T {
  const i = ctx.inputs[stage];
  if (!i) throw new Error(`Missing input ${stage}`);
  return schema.parse(i.output);
}

type Draft = { pageKey: string; site: string; url: string; answerIds: Set<string>; titles: Set<string>; excerpts: Set<string> };
type Verdict = Pick<ClassifiedPage, "group" | "method" | "unclassified" | "reason" | "evidence">;

/**
 * pa_sources: every distinct cited page of the usable answers, with its website and one source group.
 * Order: the audited business's verified domains and aliases, then verified domain/URL rules, then cached model
 * verdicts, then the model fallback in batches (within the report's spending cap). A verdict is accepted only with a
 * valid group and evidence found in what the model was given; otherwise the page stays unclassified.
 */
export const paSources: StageDefinition = {
  id: "pa_sources",
  module: MODULE,
  label: "Prompt analysis 4/5: classify cited sources",
  inputs: ["pa_prompt_set", ...ANSWER_STAGES],
  timeoutMs: 240_000,
  maxAttempts: 2,
  autoRun: true,
  instructions: [classifySource],
  parseParams: (raw) => {
    z.object({}).strict().parse(raw ?? {});
    return {};
  },
  output: classifiedSources,
  async run(ctx) {
    const set = input(ctx, "pa_prompt_set", promptSetSpec);
    const answers = ANSWER_STAGES.flatMap((s) => input(ctx, s, engineAnswers).answers).filter((a) => a.status === "ok" && a.text);

    // Confirmed aliases: the audited business's domains are one website, keyed by its first domain.
    const own = bareDomains(set.target.domains);
    const ownSite = own.length ? siteKeyOf(own[0]!) : null;
    const aliases = new Map(own.map((d) => [d, ownSite!] as const));

    const pages = new Map<string, Draft>();
    const unreadable: ClassifiedSources["unreadable"] = {};
    for (const a of answers) {
      for (const url of a.citations) {
        const pageKey = pageKeyOf(url);
        if (!pageKey) {
          unreadable[a.answerId] = (unreadable[a.answerId] ?? 0) + 1;
          continue;
        }
        const d = pages.get(pageKey) ?? { pageKey, site: siteKeyOf(pageKey, { aliases }), url, answerIds: new Set(), titles: new Set(), excerpts: new Set() };
        d.answerIds.add(a.answerId);
        pages.set(pageKey, d);
      }
    }

    // Titles and excerpts from the stored provider responses (also kept on every page, for review).
    const evidence = await ctx.answerEvidence([...new Set([...pages.values()].flatMap((p) => [...p.answerIds]))]);
    for (const e of evidence) {
      const cited = [...pages.values()].filter((p) => p.answerIds.has(e.answerId));
      for (const ev of citationEvidence(e.rawResponse, e.answerText)) {
        const key = pageKeyOf(ev.url);
        // Gemini cites through Google redirect links; its title is then the site's domain.
        const targets = key && pages.has(key) ? [pages.get(key)!] : cited.filter((p) => ev.title && (p.pageKey.split("/")[0] === ev.title.toLowerCase().replace(/^www\./, "") || p.site === ev.title.toLowerCase()));
        for (const p of targets) {
          if (ev.title && p.titles.size < 3) p.titles.add(ev.title);
          if (ev.excerpt && p.excerpts.size < 3) p.excerpts.add(ev.excerpt);
        }
      }
    }

    const verdicts = new Map<string, Verdict>();
    const pending: Draft[] = [];
    for (const p of pages.values()) {
      if (ownSite && p.site === ownSite) {
        verdicts.set(p.pageKey, { group: "company", method: "alias", unclassified: null, reason: "The audited business's verified website.", evidence: null });
        continue;
      }
      const rule = ruleGroup(p.pageKey, p.site);
      if (rule) verdicts.set(p.pageKey, { group: rule.group, method: "rule", unclassified: null, reason: `Verified rule: ${rule.rule}.`, evidence: null });
      else pending.push(p);
    }

    for (const c of await ctx.cachedSourceClassifications(pending.map((p) => p.pageKey), CLASSIFIER_VERSION)) {
      verdicts.set(c.pageKey, { group: c.group as SourceGroup, method: "cache", unclassified: c.unclassified, reason: c.reason, evidence: c.evidence });
    }

    const toAsk = pending.filter((p) => !verdicts.has(p.pageKey));
    const batches: Draft[][] = [];
    for (let i = 0; i < toAsk.length; i += BATCH) batches.push(toAsk.slice(i, i + BATCH));
    let stop: string | null = null;
    let failed = 0;
    const work = async () => {
      while (batches.length) {
        const batch = batches.shift()!;
        const given = new Map<string, PageEvidence>(batch.map((p) => [p.pageKey, { pageKey: p.pageKey, site: p.site, url: p.url, titles: [...p.titles], excerpts: [...p.excerpts] }]));
        if (stop) {
          for (const p of batch) verdicts.set(p.pageKey, { group: "unc", method: "none", unclassified: "insufficient", reason: `Not classified: ${stop}`, evidence: null });
          continue;
        }
        try {
          const out = await ctx.llm({
            instruction: classifySource,
            model: EXTRACTION_MODEL,
            input: { pages: [...given.values()].map((g) => ({ pageKey: g.pageKey, url: g.url, website: g.site, titles: g.titles, excerpts: g.excerpts })) },
            output: sourceVerdicts,
          });
          const byKey = new Map(out.items.map((v) => [v.pageKey, v] as const));
          for (const p of batch) {
            const checked = checkModelClassification(byKey.get(p.pageKey), given.get(p.pageKey)!);
            verdicts.set(p.pageKey, { group: checked.group, method: "model", unclassified: checked.unclassified, reason: checked.reason, evidence: checked.evidence });
            if (checked.accepted) {
              await ctx.recordSourceClassification({
                pageKey: p.pageKey,
                classifierVersion: CLASSIFIER_VERSION,
                group: checked.group,
                unclassified: checked.unclassified,
                reason: checked.reason,
                evidence: checked.evidence,
                model: EXTRACTION_MODEL.model,
              });
            }
          }
        } catch (e) {
          const msg = errorMessage(e);
          if (e instanceof SpendingCapError || e instanceof MissingPricingError || e instanceof LlmNotConfiguredError) stop = msg;
          failed += batch.length;
          for (const p of batch) verdicts.set(p.pageKey, { group: "unc", method: "none", unclassified: "insufficient", reason: `Not classified: ${msg}`, evidence: null });
        }
      }
    };
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, batches.length) }, work));

    // Website ownership: the audited business through its verified domains; another business when any of the site's
    // pages is a company page (the business publishing about itself); otherwise not established.
    const owner = new Map<string, SiteOwner>();
    for (const p of pages.values()) {
      const v = verdicts.get(p.pageKey)!;
      if (ownSite && p.site === ownSite) owner.set(p.site, "target");
      else if (v.group === "company" && owner.get(p.site) !== "target") owner.set(p.site, "business");
      else if (!owner.has(p.site)) owner.set(p.site, "unknown");
    }

    const out: ClassifiedSources = {
      classifierVersion: CLASSIFIER_VERSION,
      unreadable,
      pages: [...pages.values()].map((p) => {
        const v = verdicts.get(p.pageKey)!;
        const o = owner.get(p.site) ?? "unknown";
        return { pageKey: p.pageKey, site: p.site, url: p.url, title: [...p.titles][0] ?? null, group: v.group, owner: o, category: categoryOf(v.group, o), method: v.method, unclassified: v.unclassified, reason: v.reason, evidence: v.evidence };
      }),
    };
    return { status: failed ? "partial" : "done", output: out as unknown as JsonValue };
  },
};
