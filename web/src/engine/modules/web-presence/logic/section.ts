import { CATEGORY_LABEL } from "./pages";
import type { CitedPages } from "../schemas";

/** Report parts from the cited outside pages we checked (plain code; nothing here is written by a model). */
export const CITED_PAGES_EVIDENCE = "cited-pages";

type Observed<T> = { v: T; p: { kind: "observed"; evidence: string[] } };
const observed = <T>(v: T, evidence: string[] = [CITED_PAGES_EVIDENCE]): Observed<T> => ({ v, p: { kind: "observed", evidence } });
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export type CitedPagesInput = CitedPages & { runId: string; finishedAt: string };

export function citedPagesEvidence(cp: CitedPagesInput) {
  return { [CITED_PAGES_EVIDENCE]: { source: "Our copies of the outside pages AI cited (robots.txt followed)", ref: `stage_run ${cp.runId}`, capturedOn: cp.finishedAt.slice(0, 10) } };
}

/** Why selected pages weren't read, in plain words: "2 asked checkers not to fetch them (robots.txt), 1 refused us". */
function uncheckedSummary(pages: CitedPages["pages"]): string {
  const un = pages.filter((p) => p.state === "unchecked");
  const robots = un.filter((p) => /robots\.txt/.test(p.reason ?? "")).length;
  const time = un.filter((p) => /ran out of time/.test(p.reason ?? "")).length;
  const shell = un.filter((p) => /gave us the same/.test(p.reason ?? "")).length;
  const other = un.length - robots - time - shell;
  return [
    robots && `${robots} ask${robots === 1 ? "s" : ""} checkers like ours not to fetch ${robots === 1 ? "it" : "them"} (robots.txt)`,
    other && `${other} refused us or couldn't be read`,
    shell && `${shell} showed us only a page shared across the site`,
    time && `${time} weren't reached in time (run the check again)`,
  ]
    .filter(Boolean)
    .join(", ");
}

/** Columns besides the target in a map: the competitors AI names most in the map's answers (owner decision, 19 Nov 2026). */
export const MAX_COMPETITORS = 15;

/** What a map needs from the prompt analysis: each question's answers, the businesses each names and the pages it cites. */
export type CoverageAnswers = {
  businesses: readonly { v: { key: string; name: string } }[];
  questions: readonly { question: { v: { id: string } }; answers: readonly { v: { status: string; named?: readonly { business: string }[]; citations?: readonly string[] } }[] }[];
};

/**
 * Citation coverage, one map per service line (or one map for every question when no lines are saved). Each map:
 * columns are the target and the competitors named in the most of the line's usable answers (up to 15; ties by name);
 * rows are the websites of the pages we read that the line's answers cite and that name at least one of those
 * businesses. Sites we couldn't read, and sites naming only other businesses (or none), are counted in the scope line
 * rather than shown as rows of blanks.
 */
export function buildCitationCoverage(cp: CitedPagesInput, pa: CoverageAnswers) {
  const target = cp.businesses.find((b) => b.target)!;
  const nameOf = new Map(pa.businesses.map(({ v }) => [v.key, v.name] as const));
  const lines = cp.lines ?? [null];
  return lines.map((line) => {
    const qs = pa.questions.filter((q) => !line || line.questions.includes(q.question.v.id));
    const usable = qs.flatMap((q) => q.answers.filter((a) => a.v.status === "ok"));
    const cited = new Set(usable.flatMap((a) => a.v.citations ?? []));
    const count = new Map<string, number>();
    for (const a of usable) for (const k of new Set((a.v.named ?? []).map((n) => n.business))) count.set(k, (count.get(k) ?? 0) + 1);
    const competitors = [...count.entries()]
      .filter(([k]) => k !== target.key)
      .sort((a, b) => b[1] - a[1] || (nameOf.get(a[0]) ?? a[0]).localeCompare(nameOf.get(b[0]) ?? b[0]))
      .slice(0, MAX_COMPETITORS)
      .map(([k]) => k);
    const shown = [target.key, ...competitors];

    // The pages chosen for this line (or, without lines, every page we chose), plus any other chosen page its answers cite.
    const mine = cp.pages.filter((p) => cited.has(p.key) && (!line || (p.lines ?? []).includes(line.name) || p.state === "checked"));
    const checked = mine.filter((p) => p.state === "checked");
    const bySite = new Map<string, CitedPages["pages"]>();
    for (const p of checked) bySite.set(p.site, [...(bySite.get(p.site) ?? []), p]);
    const allSites = [...bySite.entries()].map(([site, pages]) => ({
      name: site,
      type: CATEGORY_LABEL[pages[0]!.category],
      pageKeys: pages.map((p) => p.key),
      present: shown.filter((k) => pages.some((p) => p.names.some((n) => n.business === k))),
    }));
    const sites = allSites.filter((s) => s.present.length);
    const nameless = allSites.length - sites.length;
    const unchecked = mine.filter((p) => p.state === "unchecked");

    const scope = [
      `We read ${plural(checked.length, "outside page")} that ${line ? `the ${line.name} answers` : "AI"} cited, the most-cited first (up to ${cp.cap} ${line ? "per service line" : "per report"}; sites that refuse our checker are passed over and the next pages read instead).`,
      `Columns show you and the ${plural(competitors.length, "business", "businesses")} AI named most in ${line ? `the ${plural(qs.length, "question")} of this line` : "these answers"}${competitors.length > 7 ? " (the second table continues the first)" : ""}.`,
      "A check means the business's name is on a page we read. A blank means it isn't on that page, not that the business is missing from the whole site.",
      nameless ? `${plural(nameless, "more site")} named none of these businesses and ${nameless === 1 ? "isn't" : "aren't"} shown (AI cited ${nameless === 1 ? "it" : "them"} for facts such as prices, or for businesses outside the top ${MAX_COMPETITORS}).` : "",
      unchecked.length ? `${plural(unchecked.length, "more page")} couldn't be read and ${unchecked.length === 1 ? "isn't" : "aren't"} shown: ${uncheckedSummary(unchecked)}.` : "",
      cp.ownSites ? `${plural(cp.ownSites, "cited page")} on other businesses' own websites ${cp.ownSites === 1 ? "isn't" : "aren't"} counted as outside sites.` : "",
    ]
      .filter(Boolean)
      .join(" ");

    return {
      ...(line ? { line: observed({ name: line.name, questions: line.questions }) } : {}),
      sites: sites.map((s) => observed({ name: s.name, type: s.type, pageKeys: s.pageKeys, presentBusinesses: s.present })),
      businesses: observed(shown),
      scope: observed(scope),
    };
  });
}
