import type { AssessedPages, CitedPages } from "../schemas";
import { COLUMNS, type CheckedCell, type Presence } from "./assess";
import { CATEGORY_LABEL, OUTSIDE_CATEGORIES, type OutsideCategory } from "./pages";
import { CITED_PAGES_EVIDENCE } from "./section";

/**
 * Credible & corroborated and the web presence map, built in plain code from the checked cited pages and the checked
 * model readings. Every count, summary sentence and fix is computed here; the model's words appear only as its
 * per-page descriptions, each backed by a quote found on the page.
 */
export const ASSESSED_EVIDENCE = "cited-pages-read";
/** Kinds of site, as bar and summary names. */
const KIND_PLURAL: Record<OutsideCategory, string> = {
  maps: "Maps & places",
  review: "Review platforms",
  dir: "Directories & marketplaces",
  ed: "Editorial & publications",
  comm: "Communities & social",
  off: "Official & professional sources",
  unc: "Other or unclassified sites",
};
/** Kinds of site a "Get onto" fix may point to. */
const GET_ONTO = ["dir", "review", "ed", "maps", "comm"] as const;

type Observed<T> = { v: T; p: { kind: "observed"; evidence: string[] } };
const EV = [CITED_PAGES_EVIDENCE, ASSESSED_EVIDENCE];
const observed = <T>(v: T, evidence: string[] = EV): Observed<T> => ({ v, p: { kind: "observed", evidence } });
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const list = (xs: string[]) => (xs.length <= 1 ? (xs[0] ?? "") : `${xs.slice(0, -1).join(", ")} and ${xs.at(-1)}`);
const bare = (url: string) => url.replace(/^https?:\/\//i, "").replace(/^www\./, "");
const nonEmpty = (s: string | null | undefined, fallback: string) => (s && s.trim() ? s.trim() : fallback);

export type AssessedInput = AssessedPages & { runId: string; finishedAt: string };
/** What the builder needs from the report's promptAnalysis section. */
export type PromptPages = {
  pages: readonly { v: { key: string; category: string } }[];
  questions: readonly { question: { v: { id: string; text: string } }; answers: readonly { v: { status: string; citations?: readonly string[] } }[] }[];
};

export function assessedEvidence(a: AssessedInput) {
  return { [ASSESSED_EVIDENCE]: { source: `Our reading of each cited page (${a.model}), every judgment backed by words found on the page`, ref: `stage_run ${a.runId}`, capturedOn: a.finishedAt.slice(0, 10) } };
}

type Page = CitedPages["pages"][number];
type Reading = NonNullable<AssessedPages["pages"][number]["reading"]>;
type Row = Page & { reading: Reading | null; readError: string | null };

export function buildCredible(cp: CitedPages, as: AssessedPages, pa: PromptPages, businessName: string) {
  const readings = new Map(as.pages.map((p) => [p.key, p] as const));
  const rows: Row[] = cp.pages.map((p) => ({ ...p, reading: readings.get(p.key)?.reading ?? null, readError: readings.get(p.key)?.error ?? null }));
  const target = cp.businesses.find((b) => b.target)!;
  const nameOf = new Map(cp.businesses.map((b) => [b.key, b.name] as const));
  const read = rows.filter((r) => r.state === "checked" && r.reading);
  const onPage = (r: Row) => r.reading!.presence !== "none";
  const mine = read.filter(onPage);
  const others = (r: Row) => r.names.filter((n) => n.business !== target.key).map((n) => nameOf.get(n.business) ?? n.business);

  // Usable answers and the prompts that cited each page.
  const usable = pa.questions.flatMap((q) => q.answers.filter((a) => a.v.status === "ok").map((a) => ({ prompt: q.question.v.text, cites: new Set(a.v.citations ?? []) })));
  const promptFor = (key: string) => usable.find((a) => a.cites.has(key))?.prompt ?? "";
  const catOf = new Map(pa.pages.map((p) => [p.v.key, p.v.category] as const));
  const state = new Map(rows.map((r) => [r.key, r] as const));

  // Bars: per kind of outside site, answers citing a read page where you appear vs answers whose pages of that kind
  // we read and you're on none. Answers citing only pages we didn't read are left out (never counted as absent).
  const categories = OUTSIDE_CATEGORIES.flatMap((c) => {
    const citing = usable.filter((a) => [...a.cites].some((k) => catOf.get(k) === c));
    if (!citing.length) return [];
    let present = 0;
    let absent = 0;
    let unknown = 0;
    for (const a of citing) {
      const keys = [...a.cites].filter((k) => catOf.get(k) === c);
      const known = keys.map((k) => state.get(k)).filter((r): r is Row => !!r && r.state === "checked" && !!r.reading);
      if (known.some(onPage)) present++;
      else if (known.length === keys.length) absent++;
      else unknown++;
    }
    if (present + absent === 0) return [];
    const on = [...new Set(mine.filter((r) => r.category === c).map((r) => r.site))];
    // A site with a page naming you counts as "on"; "not on" lists only sites where no page we read names you.
    const off = [...new Set(read.filter((r) => r.category === c && !onPage(r)).map((r) => r.site))].filter((x) => !on.includes(x));
    const note = [on.length ? `On ${list(on.slice(0, 2))}` : "", off.length ? `not on ${list(off.slice(0, 2))}` : "", unknown ? `${plural(unknown, "answer")} cite only pages we couldn't read` : ""].filter(Boolean).join(" · ");
    return [{ c, present, absent, note: nonEmpty(note.charAt(0).toUpperCase() + note.slice(1), "Pages we read") }];
  });

  // Web diagram: sites with a page we read, drawn under their kind of site.
  const bySite = new Map<string, Row[]>();
  for (const r of rows) bySite.set(r.site, [...(bySite.get(r.site) ?? []), r]);
  const readSites = [...bySite.entries()].filter(([, rs]) => rs.some((r) => r.state === "checked" && r.reading));
  const webSites = readSites.map(([site, rs]) => {
    const got = rs.filter((r) => r.state === "checked" && r.reading);
    const best = got.find((r) => r.reading!.presence === "rec" || r.reading!.presence === "rev") ?? got.find((r) => r.reading!.presence === "mixed") ?? got.find(onPage);
    const quality = !best ? null : best.reading!.presence === "rec" || best.reading!.presence === "rev" ? "good" : best.reading!.presence === "mixed" ? "concern" : "named";
    const label = !best ? null : best.reading!.presence === "rec" ? `Recommends you: ${best.reading!.reasons[0]!.reason}` : best.reading!.presence === "rev" ? `Shows your reviews: ${best.reading!.review!.rating}` : best.reading!.presence === "mixed" ? `Concern: ${best.reading!.concerns[0]!.concern}` : "Names you without a reason to choose you";
    return { name: site, pageCategory: rs[0]!.category, pageKeys: got.map((r) => r.key), present: !!best, quality, qualityLabel: label } as const;
  });
  const webCats = [...new Set(webSites.map((s) => s.pageCategory))].map((c) => ({ label: CATEGORY_LABEL[c as OutsideCategory], pageCategory: c }));

  // Page table: every selected page, read or not.
  const pages = rows.map((r) => {
    const presence: Presence | "unchecked" = r.state !== "checked" || !r.reading ? "unchecked" : r.reading.presence;
    const detail = presence === "unchecked" ? nonEmpty(r.reason ?? r.readError, "We couldn't read this page.") : nonEmpty(r.reading!.detail, presence === "none" ? "The page doesn't mention you." : `The page names ${businessName}.`);
    const supports =
      presence === "unchecked"
        ? "Not known: we couldn't read the page."
        : presence === "rec"
          ? `A reason to choose you: ${r.reading!.reasons.map((x) => x.reason).join("; ")}.`
          : nonEmpty(r.reading!.supports, others(r).length ? `Names ${list(others(r).slice(0, 4))} instead.` : "No reason to choose you.");
    return { title: nonEmpty(r.title, r.site), type: CATEGORY_LABEL[r.category], url: bare(r.url), prompts: r.prompts, engines: r.engines, presence, detail, supports, prompt: nonEmpty(promptFor(r.key), "—") };
  });

  // Review profiles shown on cited pages (separately checked profiles, e.g. Google, join in a later part).
  const reviews = mine
    .filter((r) => r.reading!.review)
    .map((r) => {
      const v = r.reading!.review!;
      return { label: r.site, title: nonEmpty(r.title, r.site), rating: v.rating, count: v.count, recent: nonEmpty(v.recent, "Recent reviews not shown on the page"), themes: nonEmpty(v.themes, "No themes shown"), cited: true, scale: v.scale };
    });

  // Summary sentences.
  const recs = mine.filter((r) => r.reading!.presence === "rec");
  const top = read[0];
  const insteadOf = (r: Row) => (r.reading!.recommendedInstead.length ? r.reading!.recommendedInstead : others(r));
  const topLine = top && !onPage(top) && insteadOf(top).length ? ` The page AI cites most that we could read, "${nonEmpty(top.title, top.site)}" (${top.site}), features ${list(insteadOf(top).slice(0, 3))} instead.` : "";
  const standout = recs.length
    ? `"${nonEmpty(recs[0]!.title, recs[0]!.site)}" (${recs[0]!.site}) recommends you: ${recs[0]!.reading!.reasons[0]!.reason}.${recs.length > 1 ? ` ${plural(recs.length - 1, "more page")} also recommend${recs.length === 2 ? "s" : ""} you.` : ""}${topLine}`
    : mine.length
      ? `You're named on ${plural(mine.length, "page")} of the ${read.length} we read, but none gives customers a reason to choose you.${topLine}`
      : `You aren't named on any of the ${plural(read.length, "outside page")} we read.${topLine}`;
  const biggest = [...categories].sort((a, b) => b.present + b.absent - (a.present + a.absent))[0];
  const takeaway = biggest
    ? `${KIND_PLURAL[biggest.c]} are the kind of site AI cites most among the pages we read (${plural(biggest.present + biggest.absent, "answer")}). You appear in ${biggest.present ? `${biggest.present} of them` : "none of them"}.${categories.some((c) => c.present === 0) ? ` You don't appear on any ${list(categories.filter((c) => c.present === 0).map((c) => KIND_PLURAL[c.c].toLowerCase()))} we read.` : ""}`
    : "We couldn't read enough cited pages to compare kinds of site.";

  // What to work on: data-driven, most-cited first.
  const fixes: { title: string; text: string }[] = [];
  // Only sites whose purpose is to list, review or recommend businesses: never another business's own website, and
  // not unclassified or official pages.
  const listing = (r: Row) => (GET_ONTO as readonly string[]).includes(r.category);
  // Only pages the reading says recommend or rank other businesses: a page that merely mentions names (a party-venue
  // directory naming "Giggster") isn't a place customers choose a business from.
  // One fix per site, most-cited site first: its pages that feature others but not you, together.
  const featuring = read.filter((r) => listing(r) && !onPage(r) && r.reading!.recommendedInstead.length);
  for (const site of [...new Set(featuring.map((r) => r.site))].slice(0, 2)) {
    const ps = featuring.filter((r) => r.site === site);
    const counts = new Map<string, number>();
    for (const r of ps) for (const n of new Set(r.reading!.recommendedInstead)) counts.set(n, (counts.get(n) ?? 0) + 1);
    const names = [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([n]) => n); // most-featured first, then page order
    const shown = list(names.length > 3 ? [...names.slice(0, 3), plural(names.length - 3, "other")] : names);
    const prompts = new Set(usable.filter((a) => ps.some((r) => a.cites.has(r.key))).map((a) => a.prompt)).size;
    const title = mine.some((m) => m.site === site) ? `Get onto more ${site} pages` : `Get onto ${site}`;
    const text =
      ps.length === 1
        ? `"${nonEmpty(ps[0]!.title, site)}" is cited for ${plural(prompts, "prompt")} and features ${shown}, but not you.`
        : `${ps.length} of its pages, cited for ${plural(prompts, "prompt")}, feature ${shown}, but not you: ${list(ps.map((r) => `"${nonEmpty(r.title, site)}"`))}.`;
    fixes.push({ title, text });
  }

  for (const r of mine.filter((r) => r.reading!.presence === "list").slice(0, 1)) {
    fixes.push({ title: `Give ${r.site} a reason to recommend you`, text: `"${nonEmpty(r.title, r.site)}" names you but gives no reason to choose you. Ask for your listing or mention to say what sets you apart.` });
  }

  const unread = rows.length - read.length;
  const credible = {
    intro: observed(
      `We read the outside pages AI cited most in your Prompt Analysis (${plural(read.length, "page")}) and checked how each presents you: as a recommendation with a reason, with reviews, by name only, or not at all.${unread ? ` ${plural(unread, "more page")} couldn't be read.` : ""}`,
    ),
    standout: observed(standout),
    categories: categories.map((c) => observed({ name: KIND_PLURAL[c.c], note: c.note, present: c.present, absent: c.absent })),
    takeaway: observed(takeaway),
    web: {
      categories: webCats.map((c) => observed(c)),
      sites: webSites.map((s) => observed({ ...s })),
    },
    pages: pages.map((p) => observed(p)),
    reviews: reviews.map((r) => observed(r)),
    fixes: fixes.map((f) => observed(f)),
    rules: [
      { k: "Which pages", v: `The cited outside pages, ranked by how many different prompts cited them; we read up to ${cp.cap} per report. Company websites (yours and other businesses') aren't included.` },
      { k: "How we read them", v: "Our own copy of each page, following its robots.txt. A page that refused us or that we couldn't read is shown as couldn't check, never as you being absent." },
      { k: "How you show up", v: "Recommended needs a reason to choose you quoted from the page; reviews need the rating on the page; named means the page names you without a reason. Our name check decides whether you're on the page at all." },
      { k: "Counting", v: "A bar counts usable answers citing a page of that kind. Answers citing only pages we couldn't read are left out." },
      { k: "Who judged", v: `Each page was read by ${as.model}; plain code kept a judgment only when its quote was found on the page.` },
    ].map((r) => observed(r)),
  };
  return credible;
}

/** The web presence map: one row per website among the selected pages. */
export function buildWebPresence(cp: CitedPages, as: AssessedPages) {
  const readings = new Map(as.pages.map((p) => [p.key, p.reading] as const));
  const bySite = new Map<string, Page[]>();
  for (const p of cp.pages) bySite.set(p.site, [...(bySite.get(p.site) ?? []), p]);
  // Combining a site's pages: information shown on any page wins; then a page we couldn't confirm (it may show the
  // information, so we don't claim it's missing); then "not found"; "not applicable" only when every page says so.
  const ORDER = ["P", "L", "U", "N", "A"] as const;
  return [...bySite.entries()].map(([site, ps]) => {
    const got = ps.filter((p) => p.state === "checked" && readings.get(p.key));
    const marks = COLUMNS.map((c) => {
      const cells = got.map((p) => ({ p, cell: readings.get(p.key)!.columns[c] as CheckedCell }));
      if (!cells.length) return { mark: "U" as const, from: null };
      const best = [...cells].sort((a, b) => ORDER.indexOf(a.cell.status) - ORDER.indexOf(b.cell.status))[0]!;
      return { mark: best.cell.status, from: best };
    });
    const details = Object.fromEntries(
      marks.flatMap((m, i) =>
        m.from && (m.mark === "P" || m.mark === "L") ? [[String(i), { says: nonEmpty(m.from.cell.says, "Present on the page."), excerpt: m.from.cell.quote ?? "", url: bare(m.from.p.url), issue: m.from.cell.issue ?? "", action: m.from.cell.action ?? "" }]] : [],
      ),
    );
    return observed({
      name: site,
      domain: site,
      type: CATEGORY_LABEL[ps[0]!.category],
      pageKeys: ps.map((p) => p.key),
      pagesChecked: got.length,
      pagesFailed: ps.length - got.length,
      marks: marks.map((m) => m.mark) as ["P" | "L" | "N" | "A" | "U", "P" | "L" | "N" | "A" | "U", "P" | "L" | "N" | "A" | "U", "P" | "L" | "N" | "A" | "U", "P" | "L" | "N" | "A" | "U", "P" | "L" | "N" | "A" | "U"],
      details,
    });
  });
}

export function credibleCopy(cp: CitedPages, as: AssessedInput) {
  const read = as.pages.filter((p) => p.reading).length;
  return {
    credibleFoot: observed(`Based on our own copies of ${plural(read, "cited page")}, read on ${as.finishedAt.slice(0, 10)}. A page we couldn't read says nothing about whether you're there.`),
    citedPagesTitle: observed("The outside pages AI cited most"),
    citedPagesIntro: observed(`The ${plural(cp.pages.length, "outside page")} AI cited most in your Prompt Analysis, how you show up on each, and what it gives customers as a reason to choose you.`),
  };
}
