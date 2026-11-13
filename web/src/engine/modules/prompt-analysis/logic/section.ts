import type { EvidenceEntry, PromptAnalysisSection } from "@/report/schema";
import { ENGINE_NAMES } from "../../../answers";
import type { EngineAnswers, Extractions, PromptSetSpec, StoredAnswer } from "../schemas";
import { assemblePromptAnalysis, formatRunAt } from "./aggregate";
import { newBusinessKey } from "./names";

type Envelope<T> = { v: T; p: { kind: "observed"; evidence: string[] } };
const observed = <T>(v: T, evidence: string[]): Envelope<T> => ({ v, p: { kind: "observed", evidence: [...new Set(evidence)] } });

export const PROMPT_SET_EVIDENCE = "prompt-set";
export const answerEvidenceId = (engine: number, promptId: string) => `ans-${engine}-${promptId}`;
export const runEvidenceId = (engine: number) => `run-${ENGINE_NAMES[engine]!.toLowerCase()}`;

export type BuiltSection = {
  section: PromptAnalysisSection;
  evidence: Record<string, EvidenceEntry>;
  engines: [{ name: "ChatGPT"; model: string }, { name: "Claude"; model: string }, { name: "Gemini"; model: string }];
  business: { key: string; name: string; location: string; domain: string };
};

/**
 * Plain-code assembly of the report's promptAnalysis section from the approved prompt set, the three engines' stored
 * answers and the verified extractions. Nothing here asks a model. Answers whose extraction failed the quote check
 * are shown as unavailable, with the reason.
 */
export function buildPromptAnalysisSection(input: {
  set: PromptSetSpec;
  setRunId: string;
  engines: readonly [EngineAnswers & { runId: string }, EngineAnswers & { runId: string }, EngineAnswers & { runId: string }];
  extractions: Extractions;
  extractRunId: string;
}): BuiltSection {
  const { set } = input;
  const extracted = new Map(input.extractions.items.flatMap((i) => (i.status === "verified" ? [[i.answerId, i.extraction] as const] : [])));
  const failed = new Map(input.extractions.items.flatMap((i) => (i.status === "failed" ? [[i.answerId, i.error] as const] : [])));

  const answers: StoredAnswer[] = input.engines.flatMap((e) =>
    e.answers.map((a): StoredAnswer => {
      const base: StoredAnswer = {
        answerId: a.answerId,
        promptId: a.promptId,
        engine: a.engine,
        status: a.status,
        text: a.text,
        error: a.error,
        citations: a.citations,
        searchObserved: a.searchObserved,
        respondedAt: a.respondedAt,
      };
      if (a.status === "ok" && a.text && !extracted.has(a.answerId)) {
        return { ...base, status: "error", error: `Couldn't verify what this answer says: ${failed.get(a.answerId) ?? "it was not read"}` };
      }
      return base;
    }),
  );

  const targetKey = newBusinessKey(set.target.name, new Set());
  const assembled = assemblePromptAnalysis({
    prompts: set.prompts,
    answers,
    extractions: extracted,
    target: { key: targetKey, name: set.target.name, aliases: set.target.aliases },
    ownDomains: set.target.domains,
  });

  const evidence: Record<string, EvidenceEntry> = {};
  const day = (iso: string | null | undefined) => (iso ?? new Date().toISOString()).slice(0, 10);
  evidence[PROMPT_SET_EVIDENCE] = {
    source: "Approved prompt set",
    ref: `prompt_set ${set.promptSet.id} v${set.promptSet.version} (stage_run ${input.setRunId})`,
    capturedOn: day(set.promptSet.approvedAt),
  };
  const answerById = new Map(input.engines.flatMap((e) => e.answers.map((a) => [a.answerId, { a, e }] as const)));
  input.engines.forEach((e) => {
    const first = e.answers.find((a) => a.respondedAt)?.respondedAt;
    evidence[runEvidenceId(e.engine)] = {
      source: `${ENGINE_NAMES[e.engine]} answers (${e.provider} ${e.model})`,
      ref: `stage_run ${e.runId}`,
      capturedOn: day(first),
    };
    for (const a of e.answers) {
      evidence[answerEvidenceId(e.engine, a.promptId)] = {
        source: `${ENGINE_NAMES[e.engine]} answer to ${a.promptId}`,
        ref: `stage_run ${e.runId} answer ${a.promptId}`,
        capturedOn: day(a.respondedAt ?? first),
        ...(a.servedModel ? { note: `Served by ${a.servedModel}` } : {}),
      };
    }
  });
  const evOf = (answerId: string) => {
    const hit = answerById.get(answerId);
    return hit ? answerEvidenceId(hit.e.engine, hit.a.promptId) : PROMPT_SET_EVIDENCE;
  };

  // Which answers each business / page appears in (the evidence for listing it).
  const bizEvidence = new Map<string, string[]>([[targetKey, [PROMPT_SET_EVIDENCE]]]);
  const pageEvidence = new Map<string, string[]>();
  for (const q of assembled.questions) {
    q.answers.forEach((a, engine) => {
      if (a.status !== "ok") return;
      const ev = answerEvidenceId(engine, q.prompt.id);
      for (const n of a.named) bizEvidence.set(n.business, [...(bizEvidence.get(n.business) ?? []), ev]);
      for (const c of a.citations) pageEvidence.set(c, [...(pageEvidence.get(c) ?? []), ev]);
    });
  }

  const allRuns = input.engines.map((e) => runEvidenceId(e.engine));
  const usableReads = input.extractions.items.filter((i) => i.status === "verified").length;
  const failedReads = input.extractions.items.length - usableReads;
  const collectedOn = formatRunAt(input.engines.flatMap((e) => e.answers.map((a) => a.respondedAt)).filter((x): x is string => !!x).sort()[0] ?? null);
  const loc = set.location;

  const section: PromptAnalysisSection = {
    groups: set.groups.map((g) => observed(g, [PROMPT_SET_EVIDENCE])),
    businesses: assembled.businesses.map((b) => observed({ key: b.key, name: b.name }, bizEvidence.get(b.key) ?? [PROMPT_SET_EVIDENCE])),
    pages: assembled.pages.map((p) => observed(p, pageEvidence.get(p.key) ?? allRuns)),
    questions: assembled.questions.map((q) => ({
      question: observed(q.prompt, [PROMPT_SET_EVIDENCE]),
      answers: q.answers.map((a, engine) => {
        const ev = a.answerId ? [answerEvidenceId(engine, q.prompt.id)] : [runEvidenceId(engine)];
        if (a.status === "ok") {
          return observed({ status: a.status, named: a.named, citations: a.citations, uncitedMentions: a.uncitedMentions, text: a.text, statedReason: a.statedReason, grouped: a.grouped, searchObserved: a.searchObserved, runAt: a.runAt }, ev);
        }
        return observed({ status: "unavailable" as const, reason: a.reason, runAt: a.runAt }, ev);
      }) as PromptAnalysisSection["questions"][number]["answers"],
    })),
    firstChoices: assembled.firstChoices.map((f) =>
      observed({ prompt: f.prompt, engine: f.engine, business: f.business, scope: f.scope, excerpt: f.excerpt }, [evOf(f.answerId)]),
    ),
    localAssumption: { v: null, p: { kind: "missing", reason: "Not decided for this run: whether to assume Gemini draws on Google Maps for every answer." } },
    uncitedSources: { v: null, p: { kind: "missing", reason: "Not built yet: the uncited-source analysis is a later step." } },
    run: observed(assembled.run, allRuns),
    method: [
      observed(
        {
          title: "Providers and settings",
          text:
            input.engines.map((e) => `${ENGINE_NAMES[e.engine]}: ${e.model} through the ${e.provider} API with web search on.`).join(" ") +
            ` These are the providers' APIs, not the consumer apps. Answers collected from ${collectedOn}.` +
            (loc ? ` Approximate customer location sent where supported: ${loc.city}, ${loc.region}, ${loc.country}.` : ""),
        },
        allRuns,
      ),
      observed(
        {
          title: "Prompt set",
          text: `Version ${set.promptSet.version}, ${set.prompts.length} questions in ${set.groups.length} groups (${set.groups.map((g) => g.name).join(", ")}). Each question was asked once per engine, in a fresh conversation.`,
        },
        [PROMPT_SET_EVIDENCE],
      ),
      observed(
        {
          title: "How answers were read",
          text:
            `Each answer was read by ${input.extractions.model} to list the businesses it names and how. Every quoted word was then checked against the answer text by plain code; counts are computed, not written by a model.` +
            (failedReads ? ` ${failedReads} answer${failedReads === 1 ? "" : "s"} failed that check and ${failedReads === 1 ? "is" : "are"} shown as unavailable.` : ""),
        },
        [`extract`],
      ),
    ],
    whyCards: [],
  };
  evidence["extract"] = { source: `Answer reading (${input.extractions.model})`, ref: `stage_run ${input.extractRunId}`, capturedOn: day(null) };

  const describe = (e: EngineAnswers) => `${e.model} · ${e.provider} API with web search${e.configured ? "" : " · not configured"}`;
  return {
    section,
    evidence,
    engines: [
      { name: "ChatGPT", model: describe(input.engines[0]) },
      { name: "Claude", model: describe(input.engines[1]) },
      { name: "Gemini", model: describe(input.engines[2]) },
    ],
    business: { key: targetKey, name: set.target.name, location: set.target.location, domain: set.target.domains[0] ?? "no website" },
  };
}
