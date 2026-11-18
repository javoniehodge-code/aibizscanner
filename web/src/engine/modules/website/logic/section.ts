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
 * 2. Can it access the page? No when your robots.txt disallows its crawler or page reader for this page, or
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
      { k: "2. Can AI access the page?", v: "No when your robots.txt disallows that AI's crawler or page reader for the page, or when your website turned its page reader away. Yes when its reader got the page, or your rules allow it." },
      { k: "3. Can AI read the page?", v: "For pages it can access, each AI's own page reader opens the address, quotes two passages and lists the prices, phone numbers, hours and services it can get. Yes when the passages are on the page and it got the key facts; no, needs JavaScript, when it missed key facts that only load with JavaScript." },
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
      title: `Step 2: ${ENGINE_NAMES[e]} can't access ${count(blocked.length, "page", "pages")}`,
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
      `We checked ${n} pages of your website with each AI's own tools, one step at a time: can the AI find the page, can it access it, and can it read it? Each step has its own table, so you can see exactly where a page falls short.`,
      [PAGE_SET_EVIDENCE, FINDREAD_EVIDENCE],
    ),
    discoveryWhyPages: observed(
      `The pages were chosen for the decisions customers make: your home page, the pages AI cited, contact, booking, questions, prices, one page per service, locations and a policy page. Approved ${day(input.set.pageSet.approvedAt)}.`,
      [PAGE_SET_EVIDENCE],
    ),
  };
}

// ---------------------------------------------------------------------------------------------------------------
// Structured data part (website.structuredData)
// ---------------------------------------------------------------------------------------------------------------

export const STRUCTURED_EVIDENCE = "ws-structured";

type Structured = import("../structured-stage").StructuredCheck;

export function structuredEvidence(sc: Structured & { runId: string; finishedAt: string }): Record<string, EvidenceEntry> {
  return { [STRUCTURED_EVIDENCE]: { source: "Our structured data check (the code on your pages vs what they show)", ref: `stage_run ${sc.runId}`, capturedOn: day(sc.finishedAt) } };
}

/** Stats, the problems in plain English with details for the website manager, and every fact compared. */
export function buildStructuredData(sc: Structured) {
  const ev = [STRUCTURED_EVIDENCE];
  const host = (u: string) => u.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "") || u;
  const withData = sc.pages.filter((p) => p.blocks > 0).length;
  const n = (mark: string) => sc.facts.filter((f) => f.mark === mark).length;
  const conflicts = n("r");
  const missing = n("k");
  const stats = [
    { value: `${withData} of ${sc.pages.length}`, label: "pages have structured data" },
    { value: `${n("g")} of ${sc.facts.length}`, label: "facts match your pages" },
    { value: String(conflicts), label: conflicts === 1 ? "conflict" : "conflicts" },
    { value: String(missing), label: missing === 1 ? "fact missing from code" : "facts missing from code" },
  ];
  const problems = [
    ...sc.broken.map((b) => ({
      mark: "r" as const,
      tag: "Broken",
      title: `${b.errors === 1 ? "A block" : `${b.errors} blocks`} of code on ${b.name} can't be read.`,
      why: "Machines skip code they can't read, so the facts in it are lost.",
      details: [
        { k: "Page", v: host(b.url) },
        { k: "Where in the code", v: "JSON-LD block that isn't valid JSON" },
        { k: "Fix", v: "Correct the JSON (check it with Google's Rich Results Test)." },
      ],
    })),
    ...[...sc.facts.filter((f) => f.mark === "r"), ...sc.facts.filter((f) => f.mark === "k")].map((f) => ({
      mark: f.mark as "r" | "k",
      tag: f.mark === "r" ? "Conflict" : "Missing",
      title: f.title,
      why: f.why,
      details: [
        ...(f.pageUrl ? [{ k: "Page", v: host(f.pageUrl) }] : []),
        { k: "Where in the code", v: f.where },
        ...(f.mark === "r" ? [{ k: "Code says", v: f.code }] : []),
        { k: "Page says", v: f.page },
        { k: "Fix", v: f.fix },
      ],
    })),
  ];
  return {
    stats: stats.map((s) => observed(s, ev)),
    problems: problems.map((p) => observed(p, ev)),
    facts: sc.facts.map((f) => observed({ fact: f.fact, page: f.page, code: f.code, mark: f.mark }, ev)),
  };
}

// ---------------------------------------------------------------------------------------------------------------
// Clear & complete part (website.clear)
// ---------------------------------------------------------------------------------------------------------------

export const CONTENT_EVIDENCE = "cc-score";

type Score = import("../../content/stages").ContentScore;

export function contentEvidence(sc: Score & { runId: string; finishedAt: string }): Record<string, EvidenceEntry> {
  return {
    [CONTENT_EVIDENCE]: {
      source: `Clear & complete: our assessment of your pages (${sc.models.assessor}) and each AI's website-only answers (standard: ${sc.standard.label} v${sc.standard.version})`,
      ref: `stage_run ${sc.runId}`,
      capturedOn: day(sc.finishedAt),
    },
  };
}

const clip = (s: string, n = 160) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);

/**
 * The report's Clear & complete part: one row per applicable fact, with our website assessment and each AI's
 * website-only answer; counts, verdict and fixes are computed here from the stored statuses, never written by a model.
 */
export function buildClear(sc: Score) {
  // Avoid a runtime import cycle: the cell tables are small and fixed.
  const WEB: Record<string, { mark: "g" | "k" | "r" | "n"; value: string }> = {
    enough: { mark: "g", value: "Enough detail" },
    partial: { mark: "k", value: "Some detail missing" },
    not_enough: { mark: "r", value: "Not enough information" },
    unverified: { mark: "n", value: "Couldn't verify" },
    not_applicable: { mark: "n", value: "Not applicable" },
  };
  const ANS: Record<string, { mark: "g" | "k" | "r" | "n"; value: string }> = {
    supported: { mark: "g", value: "Complete and accurate" },
    partial: { mark: "k", value: "Detail missing" },
    wrong: { mark: "r", value: "Wrong" },
    unsupported: { mark: "r", value: "Not on your website" },
    not_answered: { mark: "n", value: "Didn't answer" },
    correctly_not_stated: { mark: "n", value: "Said your site doesn't say" },
    not_tested: { mark: "n", value: "Not tested" },
  };
  const ev = [CONTENT_EVIDENCE];
  const facts = sc.facts.filter((f) => f.website.status !== "not_applicable");
  const excluded = sc.facts.filter((f) => f.website.status === "not_applicable");
  const n = facts.length;
  const count = (s: string) => facts.filter((f) => f.website.status === s).length;
  const names = (s: string) => facts.filter((f) => f.website.status === s).map((f) => f.name.toLowerCase());
  const list = (xs: string[]) => (xs.length <= 2 ? xs.join(" and ") : `${xs.slice(0, -1).join(", ")} and ${xs.at(-1)}`);
  const enough = count("enough");
  const gaps = [...names("not_enough"), ...names("partial")];
  const wrong = [0, 1, 2].map((e) => facts.filter((f) => ANS[f.answers[e]!.verdict]!.mark === "r").length);

  return {
    intro: observed(
      `We checked whether your website answers the ${n} facts customers need to choose a ${sc.standard.label.toLowerCase().replace(/ \(.*\)$/, "")} business, then asked ChatGPT, Claude and Gemini the same questions with only your website pages to go on (no web search).`,
      ev,
    ),
    verdict: observed(
      {
        heading: `Your website gives enough detail on ${enough} of ${n} decision facts.`,
        text: gaps.length ? `Customers and AI can't get the full answer on ${list(gaps)} from your pages.` : "Your pages answer every decision fact we checked.",
      },
      ev,
    ),
    summary: observed(
      {
        sub: "Answers that were complete and accurate",
        notes: ["Our assessment of your pages", ...wrong.map((w, e) => (sc.models.engines[e] ? (w ? `${w} wrong or not on your website` : "None wrong") : "Not tested"))] as [string, string, string, string],
      },
      ev,
    ),
    facts: facts.map((f) =>
      observed(
        {
          name: f.name,
          sub: f.lookFor,
          cells: [
            { ...WEB[f.website.status]!, sub: clip([/^nothing\.?$/i.test(f.website.provides.trim()) ? null : f.website.provides, f.website.missing ? `Missing: ${f.website.missing}` : null].filter(Boolean).join(" ") || f.website.provides, 220) },
            ...f.answers.map((a) => ({ ...ANS[a.verdict]!, sub: clip(a.answer ? `“${clip(a.answer, 110)}” ${a.reason}` : a.reason, 220) })),
          ] as [ClearCell, ClearCell, ClearCell, ClearCell],
        },
        ev,
      ),
    ),
    fixes: facts
      .filter((f) => f.website.fix && (f.website.status === "partial" || f.website.status === "not_enough"))
      .sort((a, b) => (a.bucket === b.bucket ? (a.website.status === "not_enough" ? -1 : 1) : a.bucket === "core" ? -1 : 1))
      .map((f) => observed({ title: f.website.fix!, text: f.website.missing ? `Missing now: ${f.website.missing}` : `Your pages don't give the ${f.name.toLowerCase()}.`, closes: f.name, example: "" }, ev)),
    rules: [
      { k: "Facts checked", v: `${sc.standard.label}, standard v${sc.standard.version}: ${n} facts${excluded.length ? `; not applicable here: ${excluded.map((f) => f.name.toLowerCase()).join(", ")}` : ""}.` },
      { k: "Our assessment", v: "Enough detail, some detail missing or not enough information, judged from your pages alone. Every positive finding is backed by a passage found word for word on your pages; otherwise it shows as couldn't verify." },
      { k: "The AIs' answers", v: "Each AI got the same pages and questions with web search off, and was told to say when the pages don't state something. Answers are checked against your pages: complete and accurate, detail missing, wrong, or not on your website." },
      { k: "Pages used", v: `${sc.pages.length} pages${sc.pages.some((p) => p.truncated) ? ", long pages shortened" : ""}${sc.leftOut.length ? `; ${sc.leftOut.length} left out (no text available)` : ""}. This tests what your pages say, not whether AI finds them (see Find & read).` },
    ].map((kv) => observed(kv, ev)),
  };
}
type ClearCell = { mark: "g" | "k" | "r" | "n"; value: string; sub: string };

export function clearCopy(sc: Score) {
  const ev = [CONTENT_EVIDENCE];
  return {
    clearPagesChecked: observed(`Pages checked: ${sc.pages.map((p) => p.name).join(" · ")}`, ev),
    clearStandard: observed(
      `The facts come from our ${sc.standard.label.toLowerCase()} standard (v${sc.standard.version}): the facts that could change whether a customer chooses you. ${applicable(sc)} of its ${sc.facts.length} apply to your business.`,
      ev,
    ),
    clearFoot: observed(`Our assessment and the scoring: ${sc.models.assessor}. AIs: ${sc.models.engines.map((m, e) => `${ENGINE_NAMES[e]} ${m ?? "not tested"}`).join(", ")}. Website only, web search off.`, ev),
  };
}

const applicable = (sc: Score) => sc.facts.filter((f) => f.website.status !== "not_applicable").length;

// ---------------------------------------------------------------------------------------------------------------
// Distinctive part (website.distinctive)
// ---------------------------------------------------------------------------------------------------------------

export const DISTINCTIVE_EVIDENCE = "ds-score";

type Dist = import("../../content/distinctive").DistinctiveScore;

export function distinctiveEvidence(ds: Dist & { runId: string; finishedAt: string }): Record<string, EvidenceEntry> {
  return { [DISTINCTIVE_EVIDENCE]: { source: `Distinctive: each AI's website-only description and answers, assessed by ${ds.models.assessor}`, ref: `stage_run ${ds.runId}`, capturedOn: day(ds.finishedAt) } };
}

/**
 * The report's Distinctive part: each AI's one-sentence description and its answers to the five questions with a flag
 * where an answer is generic, not on the website or not covered; takeaways computed here from the supported reasons and
 * which AIs picked them up.
 */
export function buildDistinctive(ds: Dist) {
  const ev = [DISTINCTIVE_EVIDENCE];
  const list = (xs: string[]) => (xs.length <= 2 ? xs.join(" and ") : `${xs.slice(0, -1).join(", ")} and ${xs.at(-1)}`);
  const tested = [0, 1, 2].filter((e) => ds.models.engines[e]);
  const ais = (es: number[]) => list(es.map((e) => ENGINE_NAMES[e]!));
  const FLAG: Record<string, (note: string) => string | null> = {
    ok: () => null,
    generic: (n) => `Generic: could describe any ${ds.noun}${n ? ` (${n.replace(/\.$/, "")})` : ""}.`,
    unsupported: (n) => `Not on your website: ${n || "it adds details your pages don't give"}`.replace(/([^.])$/, "$1."),
    not_stated: () => null,
    not_tested: (n) => `Not tested: ${n}`,
  };

  const takeaways: { k: string; v: string }[] = [];
  const all = ds.reasons.filter((r) => tested.length && tested.every((e) => r.mentionedBy.includes(e)));
  const some = ds.reasons.filter((r) => r.mentionedBy.length && !all.includes(r));
  const none = ds.reasons.filter((r) => !r.mentionedBy.length);
  if (all.length) takeaways.push({ k: "What comes through", v: `${tested.length === 3 ? "All three" : ais(tested)} pick up ${list(all.map((r) => r.name))} from your site.` });
  for (const r of some.slice(0, 2)) takeaways.push({ k: `${r.name}: easy to miss`, v: `${ais(r.mentionedBy)} ${r.mentionedBy.length === 1 ? "finds" : "find"} it; ${ais(tested.filter((e) => !r.mentionedBy.includes(e)))} ${tested.filter((e) => !r.mentionedBy.includes(e)).length === 1 ? "doesn't" : "don't"}.` });
  if (none.length) takeaways.push({ k: "Reasons AI doesn't repeat", v: `Your pages support ${list(none.map((r) => r.name))}, but no AI mentioned ${none.length === 1 ? "it" : "them"}.` });
  const unsupported = tested.map((e) => ({ e, n: ds.questions.filter((q) => q.answers[e]!.flag === "unsupported").length })).filter((x) => x.n);
  if (unsupported.length) takeaways.push({ k: "AI added things your site doesn't say", v: unsupported.map((x) => `${ENGINE_NAMES[x.e]}: ${x.n} ${x.n === 1 ? "answer" : "answers"}`).join(" · ") + ". See the flagged answers above." });
  const alt = ds.questions.find((q) => q.id === "alternative");
  if (alt && tested.every((e) => ["not_stated", "generic"].includes(alt.answers[e]!.flag)))
    takeaways.push({ k: "What sets you apart isn't established", v: `From your website alone, no AI could say when another ${ds.noun} would be better. That's a limit of your pages, not proof you have no competitors.` });
  if (!ds.reasons.length) takeaways.push({ k: "No specific reason to choose you", v: "We found no specific, supported reason to choose you on your pages: only general claims." });

  return {
    descriptions: [0, 1, 2].map((e) => observed(ds.descriptions[e] ?? (ds.models.engines[e] ? "It gave no description." : "Not tested."), ev)) as [Observed<string>, Observed<string>, Observed<string>],
    questions: ds.questions.map((q) => ({
      question: observed(q.question, ev),
      answers: q.answers.map((a) => observed({ text: a.flag === "not_stated" ? "Said your website doesn't cover this." : (a.text ?? "Not tested."), flag: FLAG[a.flag]!(a.note) }, ev)) as [Observed<{ text: string; flag: string | null }>, Observed<{ text: string; flag: string | null }>, Observed<{ text: string; flag: string | null }>],
    })),
    takeaways: takeaways.map((t) => observed(t, ev)),
    fixes: ds.fixes.map((f) => observed(f, ev)),
  };
}
