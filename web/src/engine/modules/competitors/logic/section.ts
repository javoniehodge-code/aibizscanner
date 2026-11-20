import { COMPARABLE, type CheckedValue } from "../../content/values";
import type { Standard } from "../../content/standards";
import { listed } from "../../web-presence/logic/consistent";
import type { CompetitorAssessment, CompetitorPages } from "../stages";

/**
 * The competitor comparison part (Milestone 5), plain code: no model writes a row, the summary or a card. Owner
 * decisions (20 Nov 2026): no "better or worse" judgments; a fact a business doesn't publish while another does is
 * marked (it trails on that point); the most recommended business is highlighted by the template.
 */
export const COMPETITORS_EVIDENCE = "competitor-pages";
export const COMPETITORS_READ_EVIDENCE = "competitor-read";

type Observed<T> = { v: T; p: { kind: "observed"; evidence: string[] } };
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const lower = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

export type CompetitorSectionInput = {
  standard: Pick<Standard, "id" | "facts">;
  pages: CompetitorPages & { runId: string; finishedAt: string };
  assessed: CompetitorAssessment & { runId: string; finishedAt: string };
  /** The business's own values (cc_values); null before the website check has run. */
  website: readonly CheckedValue[] | null;
  /** Citation coverage map of the compared line: which cited sites name each business. */
  coverage: { sites: readonly { v: { name: string; presentBusinesses: readonly string[] } }[] } | null;
};

export function competitorEvidence(i: CompetitorSectionInput) {
  return {
    [COMPETITORS_EVIDENCE]: { source: "Our copies of the competitors' own pages AI cited, and their home pages (robots.txt followed)", ref: `stage_run ${i.pages.runId}`, capturedOn: i.pages.finishedAt.slice(0, 10) },
    [COMPETITORS_READ_EVIDENCE]: { source: `Our reading (${i.assessed.model}) of their facts and of the AI answers, every item backed by words found on the page or in the answer`, ref: `stage_run ${i.assessed.runId}`, capturedOn: i.assessed.finishedAt.slice(0, 10) },
  };
}

export function buildCompetitors(i: CompetitorSectionInput) {
  const ev = [COMPETITORS_EVIDENCE, COMPETITORS_READ_EVIDENCE];
  const ob = <T>(v: T): Observed<T> => ({ v, p: { kind: "observed", evidence: ev } });
  const comparable = COMPARABLE[i.standard.id] ?? {};
  const [c1, c2] = i.pages.competitors;
  if (!c1 || !c2) return null;
  const ids = [i.pages.target.key, c1.key, c2.key] as const;
  const names = [i.pages.target.name, c1.name, c2.name];
  const valuesOf = (k: number, fact: string): CheckedValue[] =>
    (k === 0 ? (i.website ?? []) : (i.assessed.values.find((v) => v.key === ids[k])?.values ?? [])).filter((v) => v.fact === fact);
  const siteOf = (k: number) => (k === 0 ? "Your website" : i.pages.competitors[k - 1]!.site);
  const readOf = (k: number) => (k === 0 ? i.website !== null : i.pages.competitors[k - 1]!.pages.some((p) => p.state === "checked"));

  // One row per compared fact that at least one of the three publishes.
  const factRows = i.standard.facts
    .filter((f) => comparable[f.id])
    .map((f) => {
      const vals = [0, 1, 2].map((k) => valuesOf(k, f.id));
      return { f, vals };
    })
    .filter((r) => r.vals.some((v) => v.length));
  const missingText = (k: number) => (k === 0 ? (i.website ? "Not on your website" : "Your website isn't checked yet") : !siteOf(k) ? "Website not found" : readOf(k) ? "Not on the pages we read" : "Couldn't read its website");
  const rows = factRows.map(({ f, vals }) =>
    ob({
      name: f.name,
      sub: "From each business's own website",
      cells: vals.map((v, k) => ({ value: v.length ? listed(comparable[f.id]!.kind, v) : missingText(k), sub: v.length ? "" : k === 0 ? "" : "", mark: v.length ? null : readOf(k) ? ("r" as const) : null })) as [
        { value: string; sub: string; mark: "r" | null },
        { value: string; sub: string; mark: "r" | null },
        { value: string; sub: string; mark: "r" | null },
      ],
    }),
  );

  // Where AI finds them: the cited sites (that we could read) naming each business, in the compared line.
  if (i.coverage) {
    const on = (k: number) => i.coverage!.sites.filter((s) => s.v.presentBusinesses.includes(ids[k]!)).map((s) => s.v.name);
    const total = i.coverage.sites.length;
    rows.push(
      ob({
        name: "Where AI finds them",
        sub: `Outside sites AI cited${i.pages.line ? ` in ${i.pages.line.name} answers` : ""}`,
        cells: [0, 1, 2].map((k) => {
          const s = on(k);
          return { value: s.length ? `${s.length} of ${total} sites` : "On none of the sites", sub: s.length ? `${s.slice(0, 2).join(", ")}${s.length > 2 ? ` and ${s.length - 2} more` : ""}` : "", mark: s.length ? null : ("r" as const) };
        }) as never,
      }),
    );
  }

  const reasonsOf = (k: number, which: "reasons" | "concerns") => {
    const r = i.assessed.reasons.find((x) => x.key === ids[k]);
    const list = r?.[which] ?? [];
    if (list.length) return list.map((x) => ({ title: x.title, detail: x.detail }));
    const none = which === "reasons" ? `No answer we read gives a reason to choose ${names[k]}.` : `No answer we read raises a concern about ${names[k]}.`;
    return [{ title: r?.error ? "Couldn't read the answers" : which === "reasons" ? "No reason given" : "No concern raised", detail: r?.error ? "Run the comparison again." : none }];
  };

  // Plain-code summary and cards.
  const t = i.pages.target;
  const N = i.pages.answers;
  const scope = i.pages.line ? `your ${i.pages.line.name} answers` : "the answers";
  const summary =
    i.pages.chosenBy === "admin"
      ? `You chose to compare ${c1.name} and ${c2.name}. In ${scope}, AI recommends them in ${c1.recommended} and ${c2.recommended} of ${N}, and you in ${t.recommended}.`
      : `${c1.name} and ${c2.name} are the businesses AI recommends most in ${scope} (${c1.recommended} and ${c2.recommended} of ${N} answers). AI recommends you in ${t.recommended}.`;

  const only = factRows.find((r) => r.vals[0]!.length && !r.vals[1]!.length && !r.vals[2]!.length && readOf(1) && readOf(2));
  const lacking = factRows.find((r) => !r.vals[0]!.length && r.vals[1]!.length && r.vals[2]!.length && i.website);
  const ahead = [c1, c2].filter((c) => c.recommended > t.recommended).sort((a, b) => b.recommended - a.recommended)[0];
  const cards = [
    only
      ? { kind: "YOUR ADVANTAGE", heading: `Only you publish your ${lower(only.f.name)}`, text: `Neither ${c1.name} nor ${c2.name} gives it on the pages we read, so AI can only quote yours.`, link: "See Clear & complete", target: "b3", dark: false }
      : { kind: "YOUR ADVANTAGE", heading: "No fact only you publish", text: `Every fact your website gives, ${c1.name} or ${c2.name} gives too.`, link: "See Clear & complete", target: "b3", dark: false },
    lacking
      ? { kind: "IMPORTANT DISADVANTAGE", heading: `They publish their ${lower(lacking.f.name)}; you don't`, text: `${c1.name} and ${c2.name} both give it, so AI can compare them and not you.`, link: "See Clear & complete", target: "b3", dark: false }
      : ahead
        ? { kind: "IMPORTANT DISADVANTAGE", heading: `${ahead.name} is recommended more often`, text: `AI recommends ${ahead.name} in ${ahead.recommended} of ${N} answers, and you in ${t.recommended}.`, link: "See Businesses named", target: "p2", dark: false }
        : { kind: "IMPORTANT DISADVANTAGE", heading: "No clear disadvantage found", text: "You publish what they publish, and AI recommends you as often.", link: "See Businesses named", target: "p2", dark: false },
    lacking
      ? { kind: "DO FIRST", heading: `Publish your ${lower(lacking.f.name)}`, text: "Put it on your website in plain text, where AI can read it.", link: "See Clear & complete", target: "b3", dark: true }
      : { kind: "DO FIRST", heading: "Get onto the sites that feature them", text: "Ask the outside sites AI cites to include you, starting with the ones that name both competitors.", link: "See Citation coverage", target: "x7", dark: true },
  ];

  return {
    compared: ob([c1.key, c2.key] as [string, string]),
    summary: ob(summary),
    rows,
    reasons: [0, 1, 2].map((k) => ob(reasonsOf(k, "reasons"))) as never,
    concerns: [0, 1, 2].map((k) => ob(reasonsOf(k, "concerns"))) as never,
    cards: cards.map(ob),
    scope: `${plural(N, "answer")}${i.pages.line ? ` in ${i.pages.line.name}` : ""} · their own websites as AI cited them`,
  };
}
