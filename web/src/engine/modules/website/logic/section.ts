import { ENGINE_NAMES } from "../../../answers";
import type { EvidenceEntry } from "@/report/schema";
import type { JsCheck } from "../js-stage";
import type { PageSetSpec, Snapshots } from "../schemas";
import type { FindRead } from "../test-stages";
import { pagePurpose } from "./findread";
import { CRAWLERS } from "./robots";

/**
 * The report's website "Find & read" part (website.discovery), built in plain code from the website stages. Every value
 * comes from stored stage outputs; nothing is written by a model. Page names, groups, codes and notes follow the
 * template's data contract (src/report/schema.ts, websiteDiscovery).
 */

export const PAGE_SET_EVIDENCE = "ws-page-set";
export const SNAPSHOT_EVIDENCE = "ws-snapshots";
export const FINDREAD_EVIDENCE = "ws-findread";
export const JSCHECK_EVIDENCE = "ws-jscheck";

type Observed<T> = { v: T; p: { kind: "observed"; evidence: string[] } };
const observed = <T>(v: T, evidence: string[]): Observed<T> => ({ v, p: { kind: "observed", evidence } });
const missing = (reason: string) => ({ v: null, p: { kind: "missing" as const, reason } });
const day = (iso: string) => iso.slice(0, 10);

export type SectionInputs = {
  set: PageSetSpec & { runId: string };
  snap: Snapshots & { runId: string };
  findRead: FindRead & { runId: string; finishedAt: string };
  js: (JsCheck & { runId: string; finishedAt: string }) | null;
  /** When our snapshots were taken (the ws_snapshot run's finish). */
  snapshotAt: string;
};

/** Groups shown on the slide, in order. */
const GROUPS: { title: string; description: string; kinds: readonly string[] }[] = [
  { title: "Main pages", description: "The pages a customer uses to decide and get in touch: home, about, contact, booking and locations.", kinds: ["home", "about", "contact", "booking", "location"] },
  { title: "Services and prices", description: "Pages for each service you offer, and your prices.", kinds: ["service", "pricing"] },
  { title: "Questions and policies", description: "Answers to common questions and the terms customers agree to.", kinds: ["faq", "policy"] },
  { title: "Other pages", description: "Other pages chosen for this check.", kinds: ["blog", "other"] },
];

const SEARCH: Record<string, "g" | "r" | "d"> = { found: "g", not_found: "r", unconfirmed: "d", not_tested: "d" };
const READ: Record<string, "g" | "p" | "f" | "u"> = { readable: "g", partial: "p", unsuccessful: "f", unconfirmed: "u", not_tested: "u" };

function pageName(p: { kind: string; title: string | null; reason: string }): string {
  if (p.kind === "home") return "Home page";
  const n = pagePurpose(p);
  return n.charAt(0).toUpperCase() + n.slice(1);
}

/** Published robots.txt rules for each AI's search crawler, across the checked pages. */
function permissions(snap: Snapshots) {
  return [0, 1, 2].map((engine) => {
    const token = CRAWLERS.find((c) => c.engine === engine && c.purpose === "search")!.token;
    const verdicts = snap.pages.map((p) => p.permissions[token]?.verdict ?? "unconfirmed");
    const blocked = verdicts.filter((v) => v === "blocked").length;
    const allowed = verdicts.filter((v) => v === "allowed").length;
    const n = verdicts.length;
    if (blocked === n) return { mark: "r" as const, label: "Blocked by your site rules", searchAccess: `${token} blocked by robots.txt` };
    if (blocked) return { mark: "r" as const, label: `Blocked on ${blocked} of ${n} pages`, searchAccess: `${token} blocked on some pages` };
    if (allowed === n) return { mark: "g" as const, label: "Allowed by your site rules", searchAccess: `${token} allowed by robots.txt` };
    return { mark: "d" as const, label: "Site rules couldn't be confirmed", searchAccess: `${token}: robots.txt unconfirmed` };
  });
}

export function buildDiscovery(input: SectionInputs) {
  const { set, snap, findRead, js } = input;
  const ev = [PAGE_SET_EVIDENCE, SNAPSHOT_EVIDENCE, FINDREAD_EVIDENCE];
  const byUrl = new Map(findRead.pages.map((p) => [p.url, p]));
  const pages = snap.pages.flatMap((pg) => {
    const fr = byUrl.get(pg.url);
    return fr ? [{ pg, fr, name: pageName(pg) }] : [];
  });

  const pageGroups = GROUPS.map((g) => ({ g, rows: pages.filter((p) => g.kinds.includes(p.pg.kind)) }))
    .filter((x) => x.rows.length)
    .map(({ g, rows }) => ({
      group: observed({ title: g.title, description: g.description }, [PAGE_SET_EVIDENCE]),
      pages: rows.map(({ pg, fr, name }) => ({
        page: observed({ name, url: pg.url, why: pg.reason }, [PAGE_SET_EVIDENCE]),
        results: [0, 1, 2].map((e) => observed({ search: SEARCH[fr.results[e]!.search]!, read: READ[fr.results[e]!.read]! }, [FINDREAD_EVIDENCE])) as [
          Observed<{ search: "g" | "r" | "d"; read: "g" | "p" | "f" | "u" }>,
          Observed<{ search: "g" | "r" | "d"; read: "g" | "p" | "f" | "u" }>,
          Observed<{ search: "g" | "r" | "d"; read: "g" | "p" | "f" | "u" }>,
        ],
      })),
    }));

  const notes = pages.flatMap(({ fr, name }) =>
    fr.results.flatMap((r, engine) => (r.note ? [observed({ page: name, engine, text: `${r.label}. ${r.note}` }, [FINDREAD_EVIDENCE])] : [])),
  );

  const jsEv = [JSCHECK_EVIDENCE];
  const MARK: Record<string, "g" | "k" | "r"> = { same: "g", minor: "g", content_needs_js: "k", key_facts_need_js: "r" };
  const rawVsLoaded = js
    ? observed(
        js.pages.flatMap((p) => {
          const pg = pages.find((x) => x.pg.url === p.url);
          if (!pg || p.verdict === "not_checked") return [];
          return [{ page: pg.name, raw: `${p.rawWords.toLocaleString("en-US")} words`, loaded: `${p.renderedWords.toLocaleString("en-US")} words`, mark: MARK[p.verdict]!, result: p.label }];
        }),
        jsEv,
      )
    : missing("Our JavaScript check hasn't run for this report.");

  return {
    permissions: permissions(snap).map((p) => observed(p, [SNAPSHOT_EVIDENCE])) as [Observed<ReturnType<typeof permissions>[number]>, Observed<ReturnType<typeof permissions>[number]>, Observed<ReturnType<typeof permissions>[number]>],
    pageGroups,
    notes,
    rawVsLoaded,
    attention: attention(pages, js).map((a) => observed(stripJs(a), a.js ? [FINDREAD_EVIDENCE, JSCHECK_EVIDENCE] : [FINDREAD_EVIDENCE])),
    how: [
      { k: "Search test", v: "A fresh branded question per page to each AI's own search, without the address or our page text. Found only if that page itself is among its results or citations." },
      { k: "Reading test", v: "Each AI's own page-reading tool opens the address and quotes two passages, then lists the prices, phone numbers, hours and services it can get from the page. Read only when the passages are on the page; key facts are scored against what a visitor sees." },
      { k: "JavaScript check", v: "Our own diagnostic, not an AI's view: we load each page with and without scripts and compare. Most AI page readers don't run scripts." },
      { k: "Site rules", v: "What your robots.txt publishes for each AI's search crawler. It shows permission, not what a crawler actually saw." },
      { k: "Scope", v: `${pages.length} pages approved on ${day(set.pageSet.approvedAt)}. These are the AI providers' API tools, not their consumer apps.` },
    ].map((kv) => observed(kv, ev)),
  };
}

type PageRow = { pg: Snapshots["pages"][number]; fr: FindRead["pages"][number]; name: string };
type Attention = { title: string; engines: number[]; what: string; next: string; technical: string; js?: boolean };
const stripJs = (a: Attention): Omit<Attention, "js"> => {
  const { js, ...rest } = a;
  void js;
  return rest;
};

/** The few things to fix first, from the results (plain rules, in this order). */
function attention(pages: PageRow[], js: JsCheck | null): Attention[] {
  const out: Attention[] = [];
  const list = (xs: string[]) => (xs.length <= 2 ? xs.join(" and ") : `${xs.slice(0, -1).join(", ")} and ${xs.at(-1)}`);

  // 1. Key facts that load only with JavaScript, and the AIs that missed them.
  for (const p of js?.pages.filter((x) => x.verdict === "key_facts_need_js") ?? []) {
    const row = pages.find((r) => r.pg.url === p.url);
    if (!row) continue;
    const missed = [0, 1, 2].filter((e) => (row.fr.results[e]!.extraction?.missedJsOnly ?? 0) > 0);
    out.push({
      title: `${row.name}: key facts load with JavaScript`,
      engines: missed,
      what: `${p.reason}${missed.length ? ` ${list(missed.map((e) => ENGINE_NAMES[e]!))} didn't get them.` : ""}`,
      next: p.recommendation ?? "Make these facts part of the page itself, so they don't depend on JavaScript.",
      technical: `Our check: ${p.rawWords} words without scripts, ${p.renderedWords} with them. ${p.url}`,
      js: true,
    });
  }

  // 2. Pages an AI's reading tool couldn't open.
  for (const e of [0, 1, 2]) {
    const failed = pages.filter((r) => r.fr.results[e]!.read === "unsuccessful");
    if (!failed.length) continue;
    out.push({
      title: `${ENGINE_NAMES[e]} couldn't open ${failed.length === 1 ? "a page" : `${failed.length} pages`}`,
      engines: [e],
      what: `${ENGINE_NAMES[e]}'s page reader was refused on ${list(failed.map((r) => r.name))}, while it could open others.`,
      next: "Check whether your website's security settings or firewall block this AI's page reader, and allow it if you want it to read these pages.",
      technical: failed.map((r) => r.pg.url).join(" · "),
    });
  }

  // 3. Pages no AI found in search.
  const unfound = pages.filter((r) => r.fr.results.every((x) => x.search === "not_found"));
  if (unfound.length)
    out.push({
      title: `${unfound.length} ${unfound.length === 1 ? "page wasn't" : "pages weren't"} found by any AI's search`,
      engines: [0, 1, 2],
      what: `Asked for these pages by name, no AI's search returned ${list(unfound.map((r) => r.name))}.`,
      next: "Link these pages from your home page and main menu, give each a clear title, and list them in your sitemap.",
      technical: unfound.map((r) => r.pg.url).join(" · "),
    });
  return out;
}

export function sectionEvidence(input: SectionInputs): Record<string, EvidenceEntry> {
  const out: Record<string, EvidenceEntry> = {
    [PAGE_SET_EVIDENCE]: { source: `Approved website pages (v${input.set.pageSet.version})`, ref: `stage_run ${input.set.runId}`, capturedOn: day(input.set.pageSet.approvedAt) },
    [SNAPSHOT_EVIDENCE]: { source: "Our page snapshots and robots.txt rules", ref: `stage_run ${input.snap.runId}`, capturedOn: day(input.snapshotAt) },
    [FINDREAD_EVIDENCE]: { source: "AI search and reading tests (each AI's own tools)", ref: `stage_run ${input.findRead.runId}`, capturedOn: day(input.findRead.finishedAt) },
  };
  if (input.js) out[JSCHECK_EVIDENCE] = { source: "Our JavaScript check (headless browser)", ref: `stage_run ${input.js.runId}`, capturedOn: day(input.js.finishedAt) };
  return out;
}

export function discoveryCopy(input: SectionInputs) {
  const n = input.snap.pages.length;
  return {
    discoveryIntro: observed(
      `We checked ${n} pages of your website with each AI's own tools: can its search find each page, and can its page reader open it and get the key facts?`,
      [PAGE_SET_EVIDENCE, FINDREAD_EVIDENCE],
    ),
    discoveryWhyPages: observed(
      `The pages were chosen for the decisions customers make: your home page, the pages AI cited, contact, booking, questions, prices, one page per service, locations and a policy page. Approved ${day(input.set.pageSet.approvedAt)}.`,
      [PAGE_SET_EVIDENCE],
    ),
  };
}
