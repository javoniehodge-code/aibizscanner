import { COPY_KEYS, SCHEMA_VERSION, SECTIONS, type ReportDocument } from "@/report/schema";
import type { BuiltSection } from "../../prompt-analysis/logic/section";
import type { WebPresenceSection } from "../../web-presence/section-stage";
import type { WebsiteSection } from "../../website/section-stage";
import { PROMPT_SET_EVIDENCE, runEvidenceId } from "../../prompt-analysis/logic/section";

const NOT_BUILT = "Not produced: the pipeline stages for this part of the report haven't been built yet.";
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "14 Nov 2026" from an ISO date or timestamp (UTC). */
export function formatDay(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) throw new Error(`Not a date: ${iso}`);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/** The parts of the report built so far, in report order. */
function producedSoFar(website: WebsiteSection | null, web: WebPresenceSection | null): string {
  const parts = [
    "AI Recommendations",
    website && "Find & read",
    website?.structuredData && "Structured data",
    website?.clear && "Clear & complete",
    website?.distinctive && "Distinctive",
    web && "Citation coverage",
    web?.credible && "Credible & corroborated",
  ].filter(Boolean) as string[];
  return parts.length === 1 ? "Only the AI Recommendation section has been produced for this report" : `Produced so far: ${parts.slice(0, -1).join(", ")} and ${parts.at(-1)}`;
}

type Observed<T> = { v: T; p: { kind: "observed"; evidence: string[] } };
const observed = <T>(v: T, evidence: string[]): Observed<T> => ({ v, p: { kind: "observed", evidence } });
const missing = (reason: string) => ({ v: null, p: { kind: "missing" as const, reason } });

/**
 * Pipeline stage 12 for a report that so far has only the prompt analysis: the full report document, built in plain
 * code from the assembled promptAnalysis section. Every section whose stages don't exist yet is null, so the template
 * leaves its slides out; copy for those slides is marked missing. Nothing here is written by a model or invented.
 */
export function buildReportDocument(pa: BuiltSection, website: WebsiteSection | null = null, web: WebPresenceSection | null = null): ReportDocument {
  const s = pa.section;
  const runEvidence = [0, 1, 2].map(runEvidenceId).filter((id) => pa.evidence[id]);
  // The run date is the first day an answer was collected (falls back to the prompt set's approval day).
  const days = runEvidence.map((id) => pa.evidence[id]!.capturedOn).sort();
  const runDay = days[0] ?? pa.evidence[PROMPT_SET_EVIDENCE]?.capturedOn;
  if (!runDay) throw new Error("The prompt analysis has no dated evidence");
  const runDate = formatDay(runDay);
  const runEv = runEvidence.length ? runEvidence : [PROMPT_SET_EVIDENCE];

  const run = s.run.v;
  const promptSetRef = pa.evidence[PROMPT_SET_EVIDENCE]?.ref ?? "";
  const setVersion = /\bv(\d+)\b/.exec(promptSetRef)?.[1];
  const promptDetails = [
    pa.business.location,
    "English",
    `${s.questions.length} questions${setVersion ? `, prompt set v${setVersion}` : ""}`,
    pa.engines.map((e) => `${e.name} (${e.model.split(" · ")[0]})`).join(", "),
    `Run ${runDate}, 1 answer per question per AI`,
    run ? `${run.usable} of ${run.expected} answers usable` : "answer counts not recorded",
  ].join(" · ");

  const copy = Object.fromEntries(COPY_KEYS.map((k) => [k, missing(NOT_BUILT)])) as Record<(typeof COPY_KEYS)[number], unknown>;
  copy.groupLegend = observed(s.groups.map((g) => `${g.v.name}: ${g.v.description}`).join(" · "), [PROMPT_SET_EVIDENCE]);
  copy.promptReportDetails = observed(promptDetails, [PROMPT_SET_EVIDENCE, ...runEv]);
  copy.reportDetails = observed(
    `${pa.business.name} · ${promptDetails} · ${producedSoFar(website, web)}`,
    [PROMPT_SET_EVIDENCE, ...runEv],
  );

  if (website) Object.assign(copy, website.copy);
  if (web?.copy) Object.assign(copy, web.copy);

  const doc = {
    schemaVersion: SCHEMA_VERSION,
    evidence: { ...pa.evidence, ...(website?.evidence ?? {}), ...(web?.evidence ?? {}) },
    meta: observed({ runDate, language: "English" }, runEv),
    business: observed(pa.business, [PROMPT_SET_EVIDENCE]),
    engines: pa.engines.map((e, i) => observed(e, pa.evidence[runEvidenceId(i)] ? [runEvidenceId(i)] : [PROMPT_SET_EVIDENCE])),
    copy,
    promptAnalysis: s,
    ...Object.fromEntries(SECTIONS.map((k) => [k, null])),
    citationCoverage: web?.citationCoverage ?? null,
    credible: web?.credible ?? null,
    webPresence: web?.webPresence ?? null,
    // The website parts built so far; the others stay null until their stages exist.
    website: website ? { discovery: website.discovery, structuredData: website.structuredData ?? null, clear: website.clear ?? null, consistent: null, distinctive: website.distinctive ?? null } : null,
  };
  return doc as unknown as ReportDocument;
}
