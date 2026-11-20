import { COMPARABLE, phoneKey, type CheckedValue, type Kind } from "../../content/values";
import type { Standard } from "../../content/standards";
import { CATEGORY_LABEL } from "./pages";
import type { AssessedPages, CitedPages } from "../schemas";

/**
 * Consistent & current (part 4c-1), plain code only. For each compared decision fact, the website's values against each
 * outside site AI cited that names the business. Owner decision (20 Nov 2026): a fact either agrees or doesn't; a fact
 * no other source mentions (or the website doesn't give) has no status and is listed under the table.
 */
export const CONSISTENT_VERSION = "2026-11-20";
export const WEBSITE_VALUES_EVIDENCE = "website-values";
/** Source columns shown: the sites giving the most values. */
const MAX_SOURCES = 6;
const MAX_FIXES = 8;

type Observed<T> = { v: T; p: { kind: "observed"; evidence: string[] } };
const observed = <T>(v: T, evidence: string[]): Observed<T> => ({ v, p: { kind: "observed", evidence } });
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const norm = (s: string) => s.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();

const STREET: Record<string, string> = { street: "st", avenue: "ave", road: "rd", boulevard: "blvd", drive: "dr", court: "ct", place: "pl", lane: "ln", terrace: "ter", highway: "hwy", parkway: "pkwy", north: "n", south: "s", east: "e", west: "w", northwest: "nw", northeast: "ne", southwest: "sw", southeast: "se" };
/** An address's comparable form: the street line, abbreviations unified, without suite or unit. */
export function addressKey(s: string): string {
  const line = norm((s.split(",")[0] ?? s).replace(/\s(suite|ste|unit|apt)\b.*$|#.*$/i, ""));
  return line
    .split(" ")
    .map((w) => STREET[w] ?? w)
    .join(" ")
    .replace(/\b(\d+)(st|nd|rd|th)\b/g, "$1");
}
const GENERIC = new Set(["the", "a", "an", "and", "rental", "rentals", "rent", "car", "cars", "exotic", "luxury"]);
const tokens = (s: string) => norm(s).split(" ").filter((w) => w && !GENERIC.has(w));
/** Two items name the same thing: one's words are all in the other's ("Urus" in "Lamborghini Urus S"). */
function sameItem(a: string, b: string, strict: boolean): boolean {
  const [x, y] = [tokens(a), tokens(b)];
  const [small, big] = x.length <= y.length ? [x, y] : [y, x];
  if (!small.length) return false;
  if (strict && small.length < 2 && small.join(" ") !== big.join(" ")) return false;
  return small.every((w) => big.includes(w));
}

/** A value as shown in the report. */
const shown = (kind: Kind, v: CheckedValue) => (kind === "price" && v.item && !norm(v.value).includes(norm(v.item)) ? `${v.item}: ${v.value}` : kind === "yes-no" ? (v.value.toLowerCase() === "yes" ? "Yes" : "No") : v.value);
function keyOf(kind: Kind, v: CheckedValue): string {
  switch (kind) {
    case "phone":
      return phoneKey(v.value) ?? norm(v.value);
    case "address":
      return addressKey(v.value);
    case "number":
    case "money":
      return String(v.amount);
    case "price":
      return `${tokens(v.item ?? "").join(" ")}|${v.unit}|${v.amount}`;
    case "yes-no":
      return v.value.trim().toLowerCase();
    case "list":
      return tokens(v.value).join(" ");
  }
}
/** Distinct values, as shown: up to three, then "and N more". */
function listed(kind: Kind, vs: readonly CheckedValue[]): string {
  const seen = new Map<string, string>();
  for (const v of vs) if (!seen.has(keyOf(kind, v))) seen.set(keyOf(kind, v), shown(kind, v));
  // One range read as two amounts ("$1,000 – $7,000") is shown once.
  const all = [...new Set(seen.values())];
  return all.length > 3 ? `${all.slice(0, 3).join("; ")} and ${all.length - 3} more` : all.join("; ");
}

export type Cell = { mark: "g" | "r" | "n"; text: string; differs: CheckedValue[] };
/**
 * One source against the website for one fact, like for like. "g" agrees, "r" doesn't, "n" nothing to compare (the
 * source doesn't give it, the website doesn't, or no price is for the same vehicle and unit).
 */
export function compareFact(kind: Kind, web: readonly CheckedValue[], src: readonly CheckedValue[]): Cell {
  if (!src.length) return { mark: "n", text: "Not mentioned", differs: [] };
  const text = listed(kind, src);
  if (!web.length) return { mark: "n", text, differs: [] };
  if (kind === "price") {
    let matched = 0;
    const differs: CheckedValue[] = [];
    for (const s of src) {
      const same = web.filter((w) => w.unit === s.unit && sameItem(w.item ?? "", s.item ?? "", true));
      if (!same.length) continue;
      matched++;
      if (!same.some((w) => w.amount === s.amount)) differs.push(s);
    }
    if (!matched) return { mark: "n", text, differs: [] };
    return { mark: differs.length ? "r" : "g", text, differs };
  }
  if (kind === "list") {
    const differs = src.filter((s) => !web.some((w) => sameItem(w.value, s.value, false)));
    return { mark: differs.length ? "r" : "g", text, differs };
  }
  const keys = new Set(web.map((w) => keyOf(kind, w)));
  const differs = src.filter((s) => !keys.has(keyOf(kind, s)));
  return { mark: differs.length ? "r" : "g", text, differs };
}

type Reading = NonNullable<AssessedPages["pages"][number]["reading"]>;
export type ConsistentInput = {
  standard: Pick<Standard, "id" | "facts">;
  website: { values: readonly CheckedValue[]; pages: readonly { ref: string; name: string }[]; runId: string; finishedAt: string; model: string | null };
  cited: CitedPages;
  readings: readonly { key: string; reading: Reading | null }[];
};

export function websiteValuesEvidence(w: ConsistentInput["website"]) {
  return { [WEBSITE_VALUES_EVIDENCE]: { source: `Our reading of your website's facts (${w.model ?? "no model call"}), every value found on the page`, ref: `stage_run ${w.runId}`, capturedOn: w.finishedAt.slice(0, 10) } };
}

/**
 * The Consistent & current part, or null when no outside site we read gives any compared fact about the business
 * (the slide is then left out).
 */
export function buildConsistent(input: ConsistentInput, evidence: string[]) {
  const comparable = COMPARABLE[input.standard.id] ?? {};
  const facts = input.standard.facts.filter((f) => comparable[f.id]);
  const ob = <T>(v: T) => observed(v, evidence);

  // Values per outside site (a site's pages together), only from pages our name check found the business on.
  const bySite = new Map<string, { type: string; values: CheckedValue[] }>();
  for (const p of input.cited.pages) {
    const vals = input.readings.find((r) => r.key === p.key)?.reading?.values ?? [];
    if (p.state !== "checked" || !vals.length) continue;
    const s = bySite.get(p.site) ?? { type: CATEGORY_LABEL[p.category], values: [] };
    s.values.push(...vals.filter((v) => comparable[v.fact]));
    bySite.set(p.site, s);
  }
  const sites = [...bySite.entries()].filter(([, s]) => s.values.length).sort((a, b) => b[1].values.length - a[1].values.length || a[0].localeCompare(b[0])).slice(0, MAX_SOURCES);
  if (!sites.length) return null;

  const pageName = new Map(input.website.pages.map((p) => [p.ref, p.name] as const));
  const rows: { fact: (typeof facts)[number]; web: CheckedValue[]; cells: Cell[] }[] = facts.map((f) => {
    const web = input.website.values.filter((v) => v.fact === f.id);
    return { fact: f, web, cells: sites.map(([, s]) => compareFact(comparable[f.id]!.kind, web, s.values.filter((v) => v.fact === f.id))) };
  });
  const statusOf = (cells: Cell[]): "a" | "c" | null => (cells.some((c) => c.mark === "r") ? "c" : cells.some((c) => c.mark === "g") ? "a" : null);
  const compared = rows.filter((r) => statusOf(r.cells));
  const unmentioned = rows.filter((r) => !statusOf(r.cells));
  const agree = compared.filter((r) => statusOf(r.cells) === "a").length;
  const differ = compared.length - agree;

  const webText = (r: (typeof rows)[number]) => listed(comparable[r.fact.id]!.kind, r.web);
  const differences = (r: (typeof rows)[number]) =>
    r.cells.flatMap((c, i) => (c.mark === "r" ? [{ site: sites[i]![0], says: listed(comparable[r.fact.id]!.kind, c.differs) }] : []));
  const lower = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

  const factRows = compared.map((r) => {
    const st = statusOf(r.cells)!;
    const agreeing = r.cells.filter((c) => c.mark === "g").length;
    const diffs = differences(r);
    return ob({
      name: r.fact.name,
      website: { value: webText(r), pages: [...new Set(r.web.map((v) => pageName.get(v.ref ?? "") ?? v.ref ?? ""))].filter(Boolean).join(", ") || null, issue: null },
      sources: r.cells.map((c) => ({ text: c.text, mark: c.mark })),
      status: st,
      means:
        st === "a"
          ? `${plural(agreeing, "other source says", "other sources say")} the same as your website, so AI finds one consistent answer.`
          : `Sources disagree, so AI may repeat the wrong ${lower(r.fact.name)}.`,
      note: diffs.length ? diffs.map((d) => `${d.site} says ${d.says}; your website says ${webText(r)}.`).join(" ") : null,
    });
  });

  const notMentioned = unmentioned.map((r) => {
    const elsewhere = r.cells.findIndex((c) => c.text !== "Not mentioned");
    const note = !r.web.length
      ? elsewhere >= 0
        ? `Your website doesn't give this; ${sites[elsewhere]![0]} says ${r.cells[elsewhere]!.text}.`
        : "Neither your website nor the other sources we read give this."
      : elsewhere >= 0
        ? `${sites[elsewhere]![0]} gives ${r.cells[elsewhere]!.text}, which isn't for the same ${comparable[r.fact.id]!.kind === "price" ? "vehicle and unit of time" : "thing"} as your website, so it can't be compared.`
        : "No other source we read gives this.";
    return ob({ name: r.fact.name, website: r.web.length ? webText(r) : null, note });
  });

  const fixes = compared
    .filter((r) => statusOf(r.cells) === "c")
    .sort((a, b) => (a.fact.bucket === b.fact.bucket ? 0 : a.fact.bucket === "core" ? -1 : 1))
    .flatMap((r) => differences(r).map((d) => ({ r, d })))
    .slice(0, MAX_FIXES)
    .map(({ r, d }) =>
      ob({
        title: `Correct the ${lower(r.fact.name)} on ${d.site}`,
        where: `${d.site} says ${d.says}; your website says ${webText(r)}. If your website is out of date, correct it first.`,
        why: "AI can repeat whichever version it finds. One matching answer everywhere makes the detail safe to repeat.",
      }),
    );

  const n = compared.length;
  return {
    intro: ob("We compare the facts on your website with what the outside pages AI cited say about you. Each fact either agrees or doesn't."),
    verdict: ob(
      differ
        ? { heading: `${differ} of ${plural(n, "fact")} we could compare ${differ === 1 ? "doesn't" : "don't"} agree`, text: `We compared your website with ${plural(sites.length, "outside site")} AI cited that name you. Where sources disagree, AI may repeat the wrong detail; the fixes below say where to correct it.` }
        : { heading: n === 1 ? "The one fact we could compare agrees" : n === 2 ? "Both facts we could compare agree" : `All ${n} facts we could compare agree`, text: `We compared your website with ${plural(sites.length, "outside site")} AI cited that name you. Nothing they say contradicts your website.` },
    ),
    sources: sites.map(([name, s]) => ob({ name, sub: s.type })),
    facts: factRows,
    notMentioned,
    fixes,
    rules: [
      { k: "Agree", v: "At least one other source says the same as your website, and none says something different." },
      { k: "Don't agree", v: "At least one source says something different, compared like for like: phone numbers by their digits, addresses by street, prices only for the same vehicle and unit of time, and lists item by item." },
      { k: "Not mentioned by other sources", v: "No other source we read gives the fact, or your website doesn't, so there's nothing to compare. These facts have no status." },
      { k: "Sources", v: "Your website and the outside pages AI cited that name you and that we could read. A page we couldn't read is never counted as disagreeing." },
      { k: "How values are read", v: "A model reads each value off the page; we keep it only when its exact words are on the page and contain the value. Every comparison and count is plain code." },
    ].map(ob),
  };
}
