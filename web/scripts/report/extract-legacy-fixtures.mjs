#!/usr/bin/env node
// One-off, reproducible extraction of the two report fixtures from the legacy Claude Design exports, as they were
// before the template was refactored to render from JSON (commit LEGACY_COMMIT).
//
//   node web/scripts/report/extract-legacy-fixtures.mjs        (from the repo root; needs git history)
//
// Values are taken mechanically: the legacy script runs in a sandbox with capture hooks on its inline data literals,
// and pass-through strings are read from its own renderVals() output. Nothing is retyped by hand except the small
// mapping tables below (which site in the static Credible diagram corresponds to which cited page), and the
// provenance policy for MVP Miami.
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { hook, legacyScript, runLegacy } from "./legacy-sandbox.mjs";

const LEGACY_COMMIT = "879241a";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const ENGINES = ["ChatGPT", "Claude", "Gemini"];

// ---------------------------------------------------------------------------------------------------------------
// Fixture configuration
// ---------------------------------------------------------------------------------------------------------------

const FIXTURES = {
  brownstone: {
    file: "full-business-diagnostic.dc.html",
    title: "Brownstone Movers (sample report)",
    note: "Extracted from the approved design export. Every value is sample data (design/reports/README.md).",
    location: "Brooklyn, NY",
    runDate: "29 Oct 2026",
    // Credible diagram: site name -> cited page keys (PAGES in the legacy script).
    sitePages: {
      Angi: ["dr2"], Thumbtack: ["dr1"], Yelp: ["rv1", "rv2"], "Brooklyn Magazine": ["ed1"], "Time Out New York": ["ed2"],
      "Flatbush Van Lines": ["oc2"], "Red Hook Moving Co.": ["oc1"], "Google Maps": ["mp1", "mp2"], Reddit: ["cm1"], "NYSDOT registry": ["of1"],
    },
    categoryKeys: { Directories: "dir", "Review platforms": "review", Editorial: "ed", "Other movers’ sites": "other", "Maps & places": "maps", Communities: "comm", "Official records": "off" },
  },
  "mvp-miami": {
    file: "full-business-diagnostic-mvp-miami.dc.html",
    title: "MVP Miami (mixed live and sample data)",
    note:
      "Extracted from the MVP Miami comparison export, an older template. Claude answers and site checks are real (11 Nov 2026); ChatGPT, Gemini, Google and Yelp values are sample data (design/reports/README.md). Parts the older template did not have are marked missing; nothing is copied from Brownstone.",
    location: "Miami, FL",
    runDate: "11 Nov 2026",
    sitePages: {
      "Octane Rent": ["oc1"], "mph club": ["oc4"], Prestige: ["oc2"], Turo: ["dr1"], Boatsetter: ["dr2"], Giggster: ["dr3"],
      "Sarasota Magazine": ["ed1"], "VIP Cars guide": ["ed2"], "Peerspace guide": ["ed4"], "Trustpilot (RealCar)": ["rv1"], "IPS News": ["nw1"],
    },
    categoryKeys: { "Other companies’ sites": "other", Marketplaces: "dir", Editorial: "ed", "Review platforms": "review", "Press releases": "unc" },
  },
};

// ---------------------------------------------------------------------------------------------------------------
// Provenance
// ---------------------------------------------------------------------------------------------------------------

const SAMPLE = Object.freeze({ kind: "sample" });
const env = (v, p) => ({ v, p });
const missing = (reason) => ({ v: null, p: { kind: "missing", reason } });

/** Provenance policy. Brownstone: everything is sample. MVP: conservative, only clearly real values are observed. */
function policy(id) {
  if (id === "brownstone") {
    return { engine: () => SAMPLE, site: () => SAMPLE, text: () => SAMPLE, evidence: {} };
  }
  const evidence = {
    "mvp-claude-live": {
      source: "legacy-design-export",
      ref: `design/reports/full-business-diagnostic-mvp-miami.dc.html@${LEGACY_COMMIT}`,
      capturedOn: "2026-11-11",
      note: "Claude with web search, live run. The export holds the answers and excerpts shown; raw API responses were not stored.",
    },
    "mvp-site-checks": {
      source: "legacy-design-export",
      ref: `design/reports/full-business-diagnostic-mvp-miami.dc.html@${LEGACY_COMMIT}`,
      capturedOn: "2026-11-11",
      note: "Real checks of mvpmiami.com pages, robots.txt and listings, as recorded in the export. Raw page snapshots were not stored.",
    },
  };
  const live = { kind: "observed", evidence: ["mvp-claude-live"] };
  const site = { kind: "observed", evidence: ["mvp-site-checks"] };
  return {
    evidence,
    /** Per-engine values: Claude is the live run; ChatGPT and Gemini are sample. */
    engine: (i) => (i === 1 ? live : SAMPLE),
    /** Facts about the business's own website and robots.txt, checked for real. */
    site: () => site,
    /** Free text: observed only if the export itself labels it a real check / live run and never mentions sample data. */
    text: (...parts) => {
      const t = JSON.stringify(parts);
      return /sample/i.test(t) || !/real check|live run|live search/i.test(t) ? SAMPLE : site;
    },
  };
}

// ---------------------------------------------------------------------------------------------------------------
// Sandbox capture
// ---------------------------------------------------------------------------------------------------------------

function capture(script) {
  const optional = (src, anchor, name, opts) => {
    try {
      return hook(src, anchor, name, opts);
    } catch {
      return src;
    }
  };
  let s = script;
  const credFrom = s.indexOf("title: MS[3].title") - 6000;
  s = hook(s, "const pages = [", "credPages");
  s = hook(s, "const C = [", "credCats");
  s = hook(s, "reviews: [", "credReviews", { from: credFrom });
  s = hook(s, "const SRC = [", "consSources");
  s = hook(s, "const rows = [", "consRows", { from: s.indexOf("consSlide") });
  s = hook(s, "rows: [", "clearRows", { from: s.indexOf("clearSlide: show.clear") });
  s = optional(s, "perm: [", "perm");
  s = optional(s, "const JS = [", "rawVsLoaded");
  s = hook(s, "const P = [", "sdProblems", { from: s.indexOf("sd: (() =>") });
  s = hook(s, "const F = [", "sdFacts", { from: s.indexOf("sd: (() =>") });
  s = hook(s, "const ROWS = [", "compRows");
  s = s.replace("const go = (k, i) => () => this.host.go(IX(k, i));", "const go = (k, i) => Object.assign(() => this.host.go(IX(k, i)), { __target: k + i });");
  s = hook(s, "cards: [", "compCards", { from: s.indexOf("const ROWS = [") });
  s = hook(s, "const SITES0 = [", "covSites");
  s = hook(s, "const BIZ = [", "covBiz", { from: s.indexOf("const SITES0") });
  s = hook(s, "const W = [", "wpm");
  s = s.replace(/const IDS = \[TARGET, ('[A-Z]+'), ('[A-Z]+')\]/, "const IDS = (__cap.compIds = [TARGET, $1, $2])");
  s = s.replace("return { C: BrandPart, SECS };", "__cap.brand = { MS, TASKS, CASES };\nreturn { C: BrandPart, SECS };");
  s = s.replace(
    "return { C: PromptPart, SECS };",
    "__cap.prompt = { MODELS, TARGET, B, PAGES, GROUPS, P, FC, METHOD, LOCAL: typeof LOCAL === 'undefined' ? undefined : LOCAL, XSRC: typeof XSRC === 'undefined' ? undefined : XSRC, PA_N: typeof PA_N === 'undefined' ? undefined : PA_N };\nreturn { C: PromptPart, SECS };",
  );
  return runLegacy(s);
}

// ---------------------------------------------------------------------------------------------------------------
// Static Credible diagram (parsed from the legacy SVG markup)
// ---------------------------------------------------------------------------------------------------------------

function parseWebDiagram(html, cfg) {
  const svgs = [...html.matchAll(/<svg viewBox="0 0 1040 660".*?<\/svg>/gs)].map((m) => m[0]);
  const un = (t) => t.replace(/&amp;/g, "&");
  const titles = [...svgs[0].matchAll(/<title>([^<]*)<\/title>/g)].map((m) => un(m[1]));
  const qColor = {};
  if (svgs[1]) for (const m of svgs[1].matchAll(/<title>([^:<]*):[^<]*<\/title>\s*<circle [^>]*fill="([^"]+)"/g)) qColor[un(m[1])] = m[2];
  const qLabel = {};
  if (svgs[1]) for (const m of svgs[1].matchAll(/font-size="15"[^>]*>([^<]*)<tspan[^>]*>[^<]*· ([^<]*)<\/tspan>/g)) qLabel[un(m[1])] = un(m[2]);
  const QK = { "oklch(0.58 0.15 150)": "good", "oklch(0.62 0.01 265)": "named", "oklch(0.8 0.15 85)": "concern" };
  const categories = [];
  const sites = [];
  let pending = [];
  for (const t of titles) {
    const m = /^(.*): cited in \d+ of \d+ answers\.(?: You (appear|don’t appear) here\.)?$/.exec(t);
    if (!m) throw new Error("Unexpected diagram title: " + t);
    if (m[2]) pending.push({ name: m[1], present: m[2] === "appear" });
    else {
      const category = cfg.categoryKeys[m[1]];
      if (!category) throw new Error("No category key for " + m[1]);
      categories.push({ label: m[1], pageCategory: category });
      for (const p of pending) {
        const pageKeys = cfg.sitePages[p.name];
        if (!pageKeys) throw new Error("No page mapping for diagram site " + p.name);
        sites.push({
          name: p.name,
          pageCategory: category,
          pageKeys,
          present: p.present,
          quality: p.present ? (QK[qColor[p.name]] ?? null) : null,
          qualityLabel: p.present ? (qLabel[p.name] ?? null) : null,
        });
      }
      pending = [];
    }
  }
  return { categories, sites };
}

// ---------------------------------------------------------------------------------------------------------------
// Copy: report-specific sentences in the template HTML
// ---------------------------------------------------------------------------------------------------------------

const decode = (t) =>
  t
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();

/** Text of the element whose content starts with `start` (stops at the next tag). */
function htmlText(html, start) {
  const i = html.indexOf(start);
  if (i < 0) return null;
  return decode(html.slice(i, html.indexOf("<", i)));
}

/** Text after a label element, e.g. "Report details</strong> · ...". */
function textAfter(html, marker, nth = 1) {
  let i = -1;
  for (let k = 0; k < nth; k++) i = html.indexOf(marker, i + 1);
  if (i < 0) return null;
  const from = i + marker.length;
  return decode(html.slice(from, html.indexOf("<", from)));
}

// ---------------------------------------------------------------------------------------------------------------
// Build one fixture
// ---------------------------------------------------------------------------------------------------------------

function build(id) {
  const cfg = FIXTURES[id];
  const html = execSync(`git show ${LEGACY_COMMIT}:design/reports/${cfg.file}`, { cwd: ROOT, maxBuffer: 1e8 }).toString();
  const tpl = html.slice(0, html.indexOf('<script type="text/x-dc"'));
  const pol = policy(id);
  const { cap, vals } = capture(legacyScript(html));
  const pa = vals.pa;
  const { MS, TASKS, CASES } = cap.brand;
  const { MODELS, TARGET, B, PAGES, GROUPS, P, FC, METHOD, LOCAL, XSRC, PA_N } = cap.prompt;
  const isMvp = id === "mvp-miami";
  const T = (...parts) => pol.text(...parts);
  const engineIndex = (name) => {
    const i = ENGINES.indexOf(name);
    if (i < 0) throw new Error("Unknown engine " + name);
    return i;
  };
  const kv = (list) => list.map(({ k, v }) => ({ k, v }));

  // ---- business, engines, meta
  const domain = PAGES.yw[0].split("/")[0];
  const business = env({ key: TARGET, name: B[TARGET], location: cfg.location, domain }, pol.site());
  const engines = MODELS.map((model, i) => env({ name: ENGINES[i], model }, pol.engine(i)));
  const meta = env({ runDate: cfg.runDate, language: "English (US)" }, pol.site());

  // ---- copy
  const copy = {};
  const put = (key, text, prov) => {
    copy[key] = text === null || text === undefined ? missing(`Not present in the ${cfg.file} export.`) : env(text, prov ?? T(text));
  };
  const firstP = (start) => htmlText(tpl, start);
  put("websiteSummary", firstP(isMvp ? "Every AI is allowed" : "ChatGPT and Claude can read your key pages"));
  put("discoveryIntro", firstP("We selected six pages"));
  put("discoveryWhyPages", firstP(isMvp ? "Your homepage introduces all three" : "Your homepage and services page explain"));
  if (isMvp) copy.clearPagesChecked = missing("The MVP Miami export repeated Brownstone’s page list here, so it is not carried over.");
  else put("clearPagesChecked", firstP("Checked 6 pages:"));
  put("clearStandard", firstP("We use the same clear, concise and complete standard"));
  put("clearFoot", firstP(isMvp ? "5 rental facts" : "5 moving facts"));
  put("consistentFoot", firstP("5 decision facts ·"));
  put("credibleFoot", isMvp ? firstP("12 rental prompts ·") : firstP("{{ pa.n.prompts }} moving prompts").replace("{{ pa.n.prompts }}", "{prompts}"));
  put("groupLegend", firstP("Baseline: general"));
  put("competitorKicker", firstP(isMvp ? "PUBLIC COMPETITOR FACTS" : "ILLUSTRATIVE · SAMPLE COMPETITOR DATA"));
  put("competitorTitle", firstP("How do you compare with the"));
  put("competitorIntro", firstP("We compared you with the two other"));
  put("competitorReasonsIntro", firstP("What AI and customers point to when they recommend each"));
  put("competitorConcernsIntro", firstP("What AI or customers flag about each"));
  put("citedPagesTitle", firstP("Pages AI cited for"));
  put(
    "citedPagesIntro",
    isMvp ? firstP("Outside pages cited across the 12") : firstP("Outside pages cited across the {{ pa.n.prompts }}").replace("{{ pa.n.prompts }}", "{prompts}"),
  );
  put("reportDetails", textAfter(tpl, "Report details</strong>", 1)?.replace(/^· /, ""));
  put(
    "promptReportDetails",
    isMvp
      ? textAfter(tpl, "Report details</strong>", 2)?.replace(/^· /, "")
      : textAfter(tpl, "Report details</strong>", 2)
          ?.replace(/^· /, "")
          .replace("{{ pa.n.prompts }}", "{prompts}")
          .replace("{{ pa.n.usable }}", "{usable}")
          .replace("{{ pa.n.expected }}", "{expected}"),
  );

  // ---- prompt analysis
  const parse = (cell) => (cell.n ? cell.n.split(" ").map((t) => ({ business: t.split(":")[0], status: t.split(":")[1] })) : []);
  const questions = P.map((p, pi) => ({
    question: env({ id: p.id, group: p.g, demand: p.ev, text: p.q }, pol.site()),
    answers: p.c.map((cell, i) => {
      const runAt = isMvp ? cfg.runDate : `${cfg.runDate}, 14:${String(10 + pi * 3 + i).padStart(2, "0")} ET`;
      const value = cell.u
        ? { status: "unavailable", reason: cell.u, runAt }
        : {
            status: "ok",
            named: parse(cell),
            citations: (cell.c || "").split(" ").filter(Boolean),
            uncitedMentions: (cell.ns || []).map(([source, text, page]) => ({ source, text, page: page || null })),
            text: cell.a,
            statedReason: cell.w ?? null,
            grouped: cell.o === "G",
            searchObserved: !cell.nosearch,
            runAt,
          };
      return env(value, pol.engine(i));
    }),
  }));
  const firstChoices = Object.entries(FC).map(([key, [biz, scope, excerpt]]) => {
    const [prompt, engine] = key.split("|");
    return env({ prompt, engine: Number(engine), business: biz, scope, excerpt }, pol.engine(Number(engine)));
  });

  const promptAnalysis = {
    groups: GROUPS.map(([name, description]) => env({ name, description }, T(name, description))),
    businesses: Object.entries(B).map(([key, name]) => env({ key, name }, pol.site())),
    pages: Object.entries(PAGES).map(([key, [url, category]]) => env({ key, url, category }, pol.site())),
    questions,
    firstChoices,
    localAssumption:
      LOCAL === undefined
        ? missing("The MVP Miami export predates the Gemini / Google Maps assumption flag (LOCAL); whether to apply it was never recorded.")
        : env(LOCAL, { kind: "assumed", rule: "Local business: assume every Gemini answer draws on Google Maps and Business Profile data, cited or not (brief §7)." }),
    uncitedSources:
      XSRC === undefined
        ? missing("The MVP Miami export did not record sources named without a citation (XSRC).")
        : env(
            XSRC.map((x) => ({ key: x.id, name: x.n, site: x.site, named: x.named, assumedEngine: x.assumed >= 0 ? x.assumed : null, presentBusinesses: x.has.split(" ") })),
            SAMPLE,
          ),
    run:
      PA_N === undefined
        ? missing("The MVP Miami export did not record run completeness counts (PA_N).")
        : env({ prompts: PA_N.prompts, expected: PA_N.expected, usable: PA_N.usable, unavailable: PA_N.unavailable, gaps: PA_N.gaps }, SAMPLE),
    method: METHOD.map(([title, text]) => env({ title, text }, T(title, text))),
    whyCards: pa.whyCards.map((w) => env({ engine: engineIndex(w.ai), heading: w.h, text: w.v, sources: w.src }, pol.engine(engineIndex(w.ai)))),
  };

  // ---- competitors
  const comp = pa.comp;
  const competitors = {
    compared: env(cap.compIds.slice(1), T(comp.short)),
    summary: env(comp.short, T(comp.short)),
    rows: cap.compRows
      .filter((r) => !r[3])
      .map(([name, sub, cells]) =>
        env({ name, sub, cells: cells.map((c) => { const [value, s2, mark] = c.split("|"); return { value, sub: s2 || "", mark: mark || null }; }) }, T(name, sub, cells)),
      ),
    reasons: comp.reasons.map((r) => env(r.items.map(({ t, d }) => ({ title: t, detail: d })), T(r.items))),
    concerns: comp.concerns.map((r) => env(r.items.map(({ t, d }) => ({ title: t, detail: d })), T(r.items))),
    cards: cap.compCards.map(([kind, heading, text, link, go, dark]) => env({ kind, heading, text, link, target: go.__target, dark: !!dark }, T(heading, text))),
  };

  // ---- citation coverage and web presence map
  const citationCoverage = {
    sites: cap.covSites.map(([name, type, keys, has]) => env({ name, type, pageKeys: keys.split(" ").filter(Boolean), presentBusinesses: has.split(" ").filter(Boolean) }, T(name))),
    businesses: env(cap.covBiz, pol.site()),
  };
  const webPresence = cap.wpm.map(([name, domain2, type, keys, pagesChecked, pagesFailed, codes, det]) =>
    env(
      {
        name,
        domain: domain2,
        type,
        pageKeys: keys.split(" ").filter(Boolean),
        pagesChecked,
        pagesFailed,
        marks: codes.split(""),
        details: Object.fromEntries(Object.entries(det).map(([col, [says, excerpt, url, issue, action]]) => [col, { says, excerpt, url, issue, action }])),
      },
      T(name, det),
    ),
  );

  // ---- website: find & read
  const disc = vals.discSlide[0];
  const pageGroups = MS[0].groups.map((g) => ({
    group: env({ title: g.t, description: g.d }, pol.site()),
    pages: g.rows.map(([name, url, codes, why, read]) => {
      const reads = read || codes.split("").map((c) => (c === "r" ? "f" : "g")).join("");
      return {
        page: env({ name, url, why }, pol.site()),
        results: codes.split("").map((c, i) => env({ search: c, read: reads[i] }, pol.engine(i))),
      };
    }),
  }));
  const notes = Object.entries(MS[0].notes).map(([key, text]) => {
    const [page, engine] = key.split("|");
    return env({ page, engine: Number(engine), text }, pol.engine(Number(engine)));
  });
  const permLabels = cap.perm ?? MS[0].colSub.map((c) => (/allowed/i.test(c) ? ["g", "Allowed"] : ["d", "Not confirmed"]));
  const discovery = {
    permissions: permLabels.map(([mark, label], i) => env({ mark, label, searchAccess: MS[0].colSub[i] }, pol.site())),
    pageGroups,
    notes,
    rawVsLoaded: cap.rawVsLoaded
      ? env(cap.rawVsLoaded.map(([page, raw, loaded, mark, result]) => ({ page, raw, loaded, mark, result })), SAMPLE)
      : missing("The MVP Miami export has no raw-vs-fully-loaded comparison table."),
    attention: disc.attention.map((a) => env({ title: a.t, engines: a.ais.map((x) => engineIndex(x.n)), what: a.what, next: a.next, technical: a.tech }, T(a.t, a.tech))),
    how: kv(disc.how).map((x) => env(x, T(x))),
  };

  // ---- structured data
  const structuredData = {
    stats: vals.sd.stats.map(({ v, t }) => env({ value: v, label: t }, T(v, t))),
    problems: cap.sdProblems.map(([mark, tag, title, why, tech]) => env({ mark, tag, title, why, details: tech.map(([k, v]) => ({ k, v })) }, T(title, why, tech))),
    facts: cap.sdFacts.map(([fact, page, code, mark]) => env({ fact, page, code, mark }, T(fact, page, code))),
  };

  // ---- clear & complete
  const clearS = vals.clearSlide[0];
  const cellsOf = (vals2, subs) => vals2.map((x, i) => { const p = x.split("|"); return { mark: p.length > 1 ? p[0] : null, value: p[p.length - 1], sub: subs[i] }; });
  const clear = {
    intro: env(MS[1].intro, T(MS[1].intro)),
    verdict: env({ heading: clearS.verdictH, text: clearS.verdictP }, T(clearS.verdictP)),
    // First table row ("Facts given in full"): the counts are computed from the facts below; only the notes are data.
    summary: env((([, sub, , notes]) => ({ sub, notes }))(cap.clearRows[0]), T(cap.clearRows[0])),
    facts: cap.clearRows.slice(1).map(([name, sub, v, s]) => env({ name, sub, cells: cellsOf(v, s) }, T(name, v, s))),
    fixes: clearS.fixes.map((f) => env({ title: f.t, text: f.v, closes: f.closes, example: f.ex }, T(f.t, f.v))),
    rules: kv(clearS.rules).map((x) => env(x, T(x))),
  };
  const sumClear = vals.sumRows.find((r) => r.q === MS[1].title).cells[0];

  // ---- consistent & current
  const consS = vals.consSlide[0];
  const consistent = {
    intro: env(MS[2].intro, T(MS[2].intro)),
    verdict: env({ heading: consS.verdictH, text: consS.verdictP }, T(consS.verdictP)),
    sources: cap.consSources.map(([name, sub]) => env({ name, sub }, T(name, sub))),
    facts: cap.consRows.map(([name, site, src, status, means, note]) => {
      // Brownstone: [value, pages, issue]. The older MVP template: a string, or a list of items shown as bullets.
      const [value, pages, issue] = isMvp ? [Array.isArray(site) ? site.join(", ") : site, null, null] : site;
      return env({ name, website: { value, pages: pages || null, issue: issue || null }, sources: src.map(([text, mark]) => ({ text, mark })), status, means, note: note || null }, T(name, src, note));
    }),
    fixes: consS.fixes.map((f) => env({ title: f.t, where: f.where, why: f.why }, T(f.t, f.where, f.why))),
    rules: kv(consS.rules).map((x) => env(x, T(x))),
  };

  // ---- credible & corroborated
  const credS = (vals.credAll ?? vals.credSlide)[0];
  const web = parseWebDiagram(html, cfg);
  const credible = {
    intro: env(credS.intro, T(credS.intro)),
    standout: env(credS.standout, T(credS.standout)),
    categories: cap.credCats.map(([name, note, present, absent]) => env({ name, note, present, absent }, T(name, note))),
    takeaway: env(credS.catTake, T(credS.catTake)),
    web: {
      categories: web.categories.map((c) => env(c, T(c))),
      sites: web.sites.map((s) => env(s, T(s))),
    },
    pages: cap.credPages.map(([title, type, url, prompts, engines2, presence, detail, supports, prompt]) =>
      env({ title, type, url, prompts, engines: engines2, presence, detail, supports, prompt }, T(title, detail, supports)),
    ),
    reviews: cap.credReviews.map(([label, title, rating, count, recent, themes, cited, scale]) =>
      env(
        {
          label,
          title,
          rating,
          count: count === "—" ? null : count,
          recent,
          themes,
          cited: !!cited,
          // The older MVP template had no scale field; a score shown without a count had no scale either.
          scale: scale !== undefined ? scale : count === "—" ? null : 5,
        },
        T(label, themes),
      ),
    ),
    fixes: credS.fixes.map((f) => env({ title: f.t, text: f.v }, T(f.t, f.v))),
    rules: kv(credS.rules).map((x) => env(x, T(x))),
  };

  // ---- distinctive & relevant
  const distS = vals.distSlide[0];
  const distinctive = {
    descriptions: vals.sumRows.find((r) => r.cards).cards.map((c, i) => env(c.t, pol.engine(i))),
    questions: distS.rows.map((r) => ({
      question: env(r.q, pol.site()),
      answers: r.answers.map((a, i) => env({ text: a.t, flag: a.flag || null }, pol.engine(i))),
    })),
    takeaways: distS.take.map(({ k, v }) => env({ k, v }, T(k, v))),
    fixes: distS.fixes.map((f) => env({ title: f.t, text: f.v }, T(f.t, f.v))),
  };

  // ---- actions and method
  const actions = {
    tasks: TASKS.map((t) => env({ title: t.t, kind: t.kind, scope: t.scope, engines: t.ais, rows: t.rows.map(([k, v]) => ({ k, v })) }, T(t.t, t.rows))),
    cases: CASES.map((c) => env({ title: c.t, finding: c.finding, work: c.work, owner: c.owner, tasks: c.tasks }, T(c.t, c.finding))),
  };
  const methodGroups = vals.methodGroups.map((g) => env({ heading: g.h, items: g.items.map(({ t, d }) => ({ title: t, text: d })) }, T(g.items)));

  return {
    schemaVersion: "1.0",
    fixture: { id, title: cfg.title, source: `design/reports/${cfg.file}@${LEGACY_COMMIT}`, note: cfg.note },
    evidence: pol.evidence,
    meta,
    business,
    engines,
    copy,
    // The "4 of 5" count is computed by the template from website.clear.facts (the MVP export kept Brownstone's count here).
    summary: { clear: env({ text: sumClear.unit }, T(sumClear.unit)) },
    promptAnalysis,
    competitors,
    citationCoverage,
    webPresence,
    website: { discovery, structuredData, clear, consistent, distinctive },
    credible,
    actions,
    methodGroups,
  };
}

for (const id of Object.keys(FIXTURES)) {
  const out = path.join(ROOT, "fixtures", `${id}.json`);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(build(id), null, 2) + "\n");
  console.log("wrote", path.relative(ROOT, out));
}
