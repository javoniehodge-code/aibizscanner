import { CATEGORY_LABEL } from "./pages";
import type { CitedPages } from "../schemas";

/** Report parts from the cited outside pages we checked (plain code; nothing here is written by a model). */
export const CITED_PAGES_EVIDENCE = "cited-pages";
/** Columns besides the target: the businesses on the most checked sites. */
const MAX_OTHER_BUSINESSES = 7;

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
  const other = un.length - robots - time;
  return [
    robots && `${robots} ask${robots === 1 ? "s" : ""} checkers like ours not to fetch ${robots === 1 ? "it" : "them"} (robots.txt)`,
    other && `${other} refused us or couldn't be read`,
    time && `${time} weren't reached in time (run the check again)`,
  ]
    .filter(Boolean)
    .join(", ");
}

/**
 * Citation coverage: one row per website with at least one checked page, and which businesses those pages name. Sites
 * we couldn't read are left out rather than shown as blanks, and the scope line says so.
 */
export function buildCitationCoverage(cp: CitedPagesInput) {
  const checked = cp.pages.filter((p) => p.state === "checked");
  const bySite = new Map<string, CitedPages["pages"]>();
  for (const p of checked) bySite.set(p.site, [...(bySite.get(p.site) ?? []), p]);
  const sites = [...bySite.entries()].map(([site, pages]) => ({
    name: site,
    type: CATEGORY_LABEL[pages[0]!.category],
    pageKeys: pages.map((p) => p.key),
    present: [...new Set(pages.flatMap((p) => p.names.map((n) => n.business)))],
  }));

  const target = cp.businesses.find((b) => b.target)!;
  const onSites = (key: string) => sites.filter((s) => s.present.includes(key)).length;
  const others = cp.businesses
    .filter((b) => !b.target && onSites(b.key) > 0)
    .sort((a, b) => onSites(b.key) - onSites(a.key) || a.name.localeCompare(b.name))
    .slice(0, MAX_OTHER_BUSINESSES);
  const shown = [target.key, ...others.map((b) => b.key)];

  const unchecked = cp.pages.length - checked.length;
  const scope = [
    `We read the ${plural(checked.length, "outside page")} AI cited most (we check up to ${cp.cap} per report; ${plural(cp.outsidePages, "outside page was", "outside pages were")} cited in all).`,
    "A check means the business's name is on a page we read. A blank means it isn't on that page, not that the business is missing from the whole site.",
    unchecked ? `${plural(unchecked, "more page")} couldn't be read and ${unchecked === 1 ? "isn't" : "aren't"} shown: ${uncheckedSummary(cp.pages)}.` : "",
    cp.businesses.length - 1 > others.length ? `Columns show you and the other businesses found on the most sites.` : "",
  ]
    .filter(Boolean)
    .join(" ");

  return {
    sites: sites.map((s) => observed({ name: s.name, type: s.type, pageKeys: s.pageKeys, presentBusinesses: s.present.filter((k) => shown.includes(k)) })),
    businesses: observed(shown),
    scope: observed(scope),
  };
}
