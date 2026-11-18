import { ENGINE_NAMES } from "../../../answers";
import type { EvidenceEntry } from "@/report/schema";
import type { JsCheck } from "../js-stage";
import type { PageSetSpec, Snapshots } from "../schemas";
import type { FindRead, ReadTests } from "../test-stages";
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
  /** The reading tests per AI (for why a reader was turned away); null where not available. */
  reads?: (ReadTests | null)[];
  /** When our snapshots were taken (the ws_snapshot run's finish). */
  snapshotAt: string;
};

/** Groups shown on the slide, in order. */
const GROUPS: { title: string; description: string; kinds: readonly string[] }[] = [
  { title: "Main pages", description: "The pages a customer uses to get to know you and get in touch: home, about, contact and locations.", kinds: ["home", "about", "contact", "location"] },
  { title: "Services, prices and booking", description: "Pages about what you offer, what it costs and how to book, including pages an AI cited.", kinds: ["service", "pricing", "booking", "other", "blog"] },
  { title: "Questions and policies", description: "Answers to common questions and the terms customers agree to.", kinds: ["faq", "policy"] },
];

/**
 * The page's name: its title (from our plain copy, else our browser copy), else a name made from its address
 * ("/luxury-yacht-rentals-miami/" -> "Luxury yacht rentals miami"). Never the reason it was chosen.
 */
export function pageName(p: { kind: string; title: string | null; url: string }, browserTitle: string | null = null): string {
  if (p.kind === "home") return "Home page";
  const title = p.title ?? browserTitle;
  if (title) {
    const n = pagePurpose({ kind: p.kind, title, reason: "" });
    if (n) return n.charAt(0).toUpperCase() + n.slice(1);
  }
  const slug = decodeURIComponent(new URL(p.url).pathname).split("/").filter(Boolean).at(-1) ?? "";
  const words = slug.replace(/\.[a-z0-9]+$/i, "").replace(/[-_]+/g, " ").trim();
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : new URL(p.url).hostname;
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

type Find = "g" | "r" | "d";
type Access = "g" | "r" | "d";
type Read = "g" | "p" | "j" | "f" | "u" | "n";
type Steps = { search: Find; access: Access; read: Read; notes: { step: 1 | 2 | 3; text: string }[] };

const FIND: Record<string, Find> = { found: "g", not_found: "r", unconfirmed: "d", not_tested: "d" };

/**
 * The three questions for one page and one AI, each from its own evidence:
 * 1. Can it find the page? Its own search test (yes / no / not checked).
 * 2. Is it blocked from the page? Blocked when your robots.txt disallows its crawler or page reader for this page, or
 *    when the site turned its page reader away; not blocked when its reader got the page or your rules allow it.
 * 3. Can it read the page? Only asked when it isn't blocked: yes; partly; no, because key facts load with JavaScript;
 *    no; not confirmed.
 */
export function pageSteps(pg: Snapshots["pages"][number], fr: FindRead["pages"][number], engine: number, read: ReadTests["pages"][number] | null): Steps {
  const name = ENGINE_NAMES[engine]!;
  const r = fr.results[engine]!;
  const notes: Steps["notes"] = [];
  const search = FIND[r.search] ?? "d";
  if (search === "d") notes.push({ step: 1, text: r.search === "not_tested" ? `${name}'s search wasn't tested for this page.` : `No search by ${name} was observed, so we can't say either way.` });

  const tokens = CRAWLERS.filter((c) => c.engine === engine && (c.purpose === "search" || c.purpose === "user"));
  const verdicts = tokens.map((c) => ({ token: c.token, v: pg.permissions[c.token]?.verdict ?? "unconfirmed" }));
  const ruleBlocked = verdicts.filter((x) => x.v === "blocked");
  const turnedAway = r.read === "unsuccessful";
  let access: Access;
  if (ruleBlocked.length) {
    access = "r";
    notes.push({ step: 2, text: `Your robots.txt blocks ${ruleBlocked.map((x) => x.token).join(" and ")} from this page.` });
  } else if (turnedAway) {
    access = "r";
    const detail = read?.attempts.filter((a) => a.status === "error").map((a) => a.detail).filter(Boolean).join(", ");
    notes.push({ step: 2, text: `Your website turned ${name}'s page reader away${detail ? ` (it reported: ${detail})` : ""}.` });
  } else if (r.read === "readable" || r.read === "partial" || verdicts.every((x) => x.v === "allowed")) access = "g";
  else {
    access = "d";
    notes.push({ step: 2, text: `Your robots.txt couldn't be read and ${name}'s reader didn't show either way.` });
  }

  let readCode: Read;
  if (access === "r") readCode = "n";
  else if (r.read === "readable") readCode = "g";
  else if (r.read === "partial") readCode = (r.extraction?.missedJsOnly ?? 0) > 0 ? "j" : "p";
  else if (r.read === "unsuccessful") readCode = "f";
  else readCode = "u";
  if (access !== "r") {
    // Why it got this answer: the reading test's own reason (passages), then the key-fact score.
    const why = [readCode === "g" ? null : read?.reason ?? (readCode === "u" ? `${name}'s page reader showed no activity on this page, so reading is not confirmed.` : null), r.note]
      .filter((x): x is string => !!x)
      .join(" ");
    if (why) notes.push({ step: 3, text: why });
  }
  return { search, access, read: readCode, notes };
}

export function buildDiscovery(input: SectionInputs) {
  const { set, snap, findRead, js } = input;
  const ev = [PAGE_SET_EVIDENCE, SNAPSHOT_EVIDENCE, FINDREAD_EVIDENCE];
  const byUrl = new Map(findRead.pages.map((p) => [p.url, p]));
  const browserTitle = (url: string) => js?.pages.find((p) => p.url === url)?.rendered.title ?? null;
  const pages: PageRow[] = snap.pages.flatMap((pg) => {
    const fr = byUrl.get(pg.url);
    if (!fr) return [];
    const steps = [0, 1, 2].map((e) => pageSteps(pg, fr, e, input.reads?.[e]?.pages.find((p) => p.url === pg.url) ?? null));
    return [{ pg, fr, name: pageName(pg, browserTitle(pg.url)), steps }];
  });

  const pageGroups = GROUPS.map((g) => ({ g, rows: pages.filter((p) => g.kinds.includes(p.pg.kind)) }))
    .filter((x) => x.rows.length)
    .map(({ g, rows }) => ({
      group: observed({ title: g.title, description: g.description }, [PAGE_SET_EVIDENCE]),
      pages: rows.map(({ pg, name, steps }) => ({
        page: observed({ name, url: pg.url, why: pg.reason }, [PAGE_SET_EVIDENCE]),
        results: steps.map((s) => observed({ search: s.search, access: s.access, read: s.read }, [FINDREAD_EVIDENCE, SNAPSHOT_EVIDENCE])) as [Observed<StepCodes>, Observed<StepCodes>, Observed<StepCodes>],
      })),
    }));

  const notes = pages.flatMap(({ name, steps }) => steps.flatMap((s, engine) => s.notes.map((n) => observed({ page: name, engine, text: n.text, step: n.step }, [FINDREAD_EVIDENCE]))));

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
      { k: "1. Can AI find the page?", v: "A fresh question naming your business and the page, to each AI's own search, without the address. Yes only if that page itself is among its results or citations." },
      { k: "2. Is AI blocked?", v: "Blocked when your robots.txt disallows that AI's crawler or page reader for the page, or when your website turned its page reader away. Not blocked when its reader got the page, or your rules allow it." },
      { k: "3. Can AI read the page?", v: "Each AI's own page reader opens the address, quotes two passages and lists the prices, phone numbers, hours and services it can get. Yes when the passages are on the page and it got the key facts; no, needs JavaScript, when it missed key facts that only load with JavaScript." },
      { k: "JavaScript check", v: "Our own diagnostic, not an AI's view: we load each page with and without scripts and compare. Most AI page readers don't run scripts." },
      { k: "Scope", v: `${pages.length} pages approved on ${day(set.pageSet.approvedAt)}. These are the AI providers' API tools, not their consumer apps.` },
    ].map((kv) => observed(kv, ev)),
  };
}

type StepCodes = { search: Find; access: Access; read: Read };
type PageRow = { pg: Snapshots["pages"][number]; fr: FindRead["pages"][number]; name: string; steps: Steps[] };
type Attention = { title: string; engines: number[]; what: string; next: string; technical: string; js?: boolean };
const stripJs = (a: Attention): Omit<Attention, "js"> => {
  const { js, ...rest } = a;
  void js;
  return rest;
};

/** The few things to fix, one per step, each matching that step's table (plain rules, in step order). */
function attention(pages: PageRow[], js: JsCheck | null): Attention[] {
  const out: Attention[] = [];
  const list = (xs: string[]) => (xs.length <= 2 ? xs.join(" and ") : `${xs.slice(0, -1).join(", ")} and ${xs.at(-1)}`);
  const ais = (es: number[]) => list(es.map((e) => ENGINE_NAMES[e]!));
  const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

  // Step 1: pages no AI could find.
  const unfound = pages.filter((r) => r.steps.every((s) => s.search === "r"));
  if (unfound.length)
    out.push({
      title: `Step 1: no AI could find ${count(unfound.length, "page", "pages")}`,
      engines: [0, 1, 2],
      what: `Asked for them by name, no AI's search returned ${list(unfound.map((r) => r.name))}.`,
      next: "Link these pages from your home page and main menu, give each a clear title, and list them in your sitemap.",
      technical: unfound.map((r) => r.pg.url).join(" · "),
    });

  // Step 2: one item per AI that is blocked from any page.
  for (const e of [0, 1, 2]) {
    const blocked = pages.filter((r) => r.steps[e]!.access === "r");
    if (!blocked.length) continue;
    const byRule = blocked.some((r) => r.steps[e]!.notes.some((n) => n.step === 2 && n.text.startsWith("Your robots.txt")));
    out.push({
      title: `Step 2: ${ENGINE_NAMES[e]} is blocked from ${count(blocked.length, "page", "pages")}`,
      engines: [e],
      what: `${list(blocked.map((r) => r.name))}. ${byRule ? "Your site rules (robots.txt) or your website's security settings" : "Your website's security settings"} stopped ${ENGINE_NAMES[e]}'s page reader, so it can't use these pages.`,
      next: byRule
        ? `Check your robots.txt and your website's security or firewall settings, and allow ${ENGINE_NAMES[e]} if you want it to use these pages.`
        : `Ask your website host or manager whether a firewall or bot protection blocks ${ENGINE_NAMES[e]}'s page reader, and allow it if you want it to use these pages.`,
      technical: blocked.map((r) => `${r.pg.url}: ${r.steps[e]!.notes.find((n) => n.step === 2)?.text ?? "blocked"}`).join(" · "),
    });
  }

  // Step 3: key facts that need JavaScript, and the AIs that couldn't read them.
  for (const p of js?.pages.filter((x) => x.verdict === "key_facts_need_js") ?? []) {
    const row = pages.find((r) => r.pg.url === p.url);
    if (!row) continue;
    const missed = [0, 1, 2].filter((e) => row.steps[e]!.read === "j");
    if (!missed.length) continue;
    out.push({
      title: `Step 3: ${ais(missed)} can't read ${row.name}: it needs JavaScript`,
      engines: missed,
      what: `${p.reason} ${ais(missed)} didn't get them.`,
      next: p.recommendation ?? "Make these facts part of the page itself, so they don't depend on JavaScript.",
      technical: `Our check: ${p.rawWords} words without scripts, ${p.renderedWords} with them. ${p.url}`,
      js: true,
    });
  }
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
      `We checked ${n} pages of your website with each AI's own tools, one step at a time: can the AI find the page, is it blocked from it, and can it read it? Each step has its own table, so you can see exactly where a page falls short.`,
      [PAGE_SET_EVIDENCE, FINDREAD_EVIDENCE],
    ),
    discoveryWhyPages: observed(
      `The pages were chosen for the decisions customers make: your home page, the pages AI cited, contact, booking, questions, prices, one page per service, locations and a policy page. Approved ${day(input.set.pageSet.approvedAt)}.`,
      [PAGE_SET_EVIDENCE],
    ),
  };
}
