import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { CRAWLERS } from "@/engine/modules/website/logic/robots";
import { jsCheck } from "@/engine/modules/website/js-stage";
import { discovery, snapshots } from "@/engine/modules/website/schemas";
import { findRead, readTests, searchTests } from "@/engine/modules/website/test-stages";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_PAGE_CAP } from "@/lib/website-pages";
import { ApprovePagesForm, FindPagesForm, type PageRow } from "./forms";

export const metadata = { title: "Website pages — AIBizScanner internal" };
export const dynamic = "force-dynamic";

const WS_STAGES = ["ws_discover", "ws_page_set", "ws_snapshot", "ws_render", "ws_search_chatgpt", "ws_search_claude", "ws_search_gemini", "ws_read_chatgpt", "ws_read_claude", "ws_read_gemini", "ws_findread"];
const LOWER = ["chatgpt", "claude", "gemini"];
const ENGINES = ["ChatGPT", "Claude", "Gemini"];
const JS_SHORT = { key_facts_need_js: "key facts need JavaScript", content_needs_js: "content needs JavaScript", minor: "mostly readable", same: "readable", not_checked: "couldn't check" } as const;
const VERDICT = { allowed: "Allowed", blocked: "Blocked", unconfirmed: "Unconfirmed" } as const;

export default async function WebsitePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const db = await createClient();
  const latest = (stage: string) =>
    db.from("stage_run").select("id, version, status, error, output, finished_at").eq("report_id", id).eq("stage", stage).order("version", { ascending: false }).limit(1).maybeSingle();
  const [reportRes, busyRes, discRes, snapRes, setRes, frRes, jsRes, ...testRes] = await Promise.all([
    db.from("report").select("id, version, business:business_id (name, website)").eq("id", id).maybeSingle(),
    db.from("stage_run").select("id", { count: "exact", head: true }).eq("report_id", id).in("stage", WS_STAGES).in("status", ["queued", "running"]),
    latest("ws_discover"),
    latest("ws_snapshot"),
    db.from("website_page_set").select("version, pages, approved_at").eq("report_id", id).order("version", { ascending: false }).limit(1).maybeSingle(),
    latest("ws_findread"),
    latest("ws_render"),
    ...LOWER.map((e) => latest(`ws_search_${e}`)),
    ...LOWER.map((e) => latest(`ws_read_${e}`)),
  ]);
  for (const r of [reportRes, busyRes, discRes, snapRes, setRes, frRes, jsRes, ...testRes]) if (r.error) throw new Error(r.error.message);
  const fr = frRes.data?.output ? findRead.safeParse(frRes.data.output) : null;
  const js = jsRes.data?.output ? jsCheck.safeParse(jsRes.data.output) : null;
  const searches = testRes.slice(0, 3).map((t) => (t.data?.output ? searchTests.safeParse(t.data.output) : null));
  const reads = testRes.slice(3).map((t) => (t.data?.output ? readTests.safeParse(t.data.output) : null));
  const testsRan = [...testRes].reduce((sum, t) => sum + (t.data ? 1 : 0), 0);
  const report = reportRes.data;
  if (!report) notFound();
  const busy = (busyRes.count ?? 0) > 0;
  const disc = discRes.data?.output ? discovery.safeParse(discRes.data.output) : null;
  const snap = snapRes.data?.output ? snapshots.safeParse(snapRes.data.output) : null;

  const rows: PageRow[] = [];
  if (disc?.success) {
    const suggested = new Map(disc.data.suggested.map((s) => [s.url, s.reason]));
    const order = (r: PageRow) => (r.suggested ? 0 : r.sources.includes("nav") ? 1 : 2);
    for (const c of disc.data.candidates) rows.push({ url: c.url, kind: c.kind, sources: c.sources, linkText: c.linkText, suggested: suggested.get(c.url) ?? null });
    rows.sort((a, b) => order(a) - order(b) || a.url.length - b.url.length);
  }

  return (
    <main style={{ maxWidth: 1200 }}>
      <p>
        <Link href={`/reports/${id}`}>← Report</Link> · <Link href={`/reports/${id}/runs`}>Run monitor</Link>
      </p>
      <h1>
        Website pages — {report.business?.name} v{report.version}
      </h1>
      <p>
        Website: {report.business?.website ? <a href={report.business.website}>{report.business.website}</a> : <span className="error">not set on the business</span>}
      </p>
      <p className="muted">
        We find the site&apos;s pages (home page links, navigation and sitemap), suggest up to {DEFAULT_PAGE_CAP} to check, and after you approve the
        list we take our own copy of each page and read the site&apos;s published rules for each AI&apos;s crawlers. These are our checks, not
        what an AI saw; the AI search and reading tests come next.
      </p>

      <h2>1. Find pages</h2>
      {discRes.data ? (
        <p className="muted">
          Last run v{discRes.data.version}: {discRes.data.status}
          {discRes.data.error ? ` — ${discRes.data.error}` : ""}
          {disc?.success
            ? ` · ${disc.data.candidates.length} pages found${disc.data.limits.candidatesTruncated ? " (list cut at 500)" : ""} · robots.txt ${disc.data.robots.status ?? disc.data.robots.error} · sitemaps read: ${disc.data.sitemaps.map((s) => `${s.url.replace(/^https?:\/\//, "")} (${s.status ?? s.error}, ${s.urls} URLs)`).join(", ") || "none"}`
            : ""}
        </p>
      ) : null}
      <FindPagesForm reportId={id} label={discRes.data ? "Find pages again" : "Find pages"} busy={busy} />

      {disc?.success ? (
        <>
          <h2>2. Choose the pages to check</h2>
          {setRes.data ? (
            <p className="muted">
              Current approved list: v{setRes.data.version}, {(setRes.data.pages as unknown[]).length} pages, approved{" "}
              {new Date(setRes.data.approved_at!).toISOString().slice(0, 16).replace("T", " ")} UTC.
            </p>
          ) : null}
          <ApprovePagesForm reportId={id} website={disc.data.website} rows={rows} cap={disc.data.cap} busy={busy} />
        </>
      ) : null}

      {snapRes.data ? (
        <>
          <h2>3. Our snapshots and published crawler rules</h2>
          <p className="muted">
            Run v{snapRes.data.version}: {snapRes.data.status}
            {snapRes.data.error ? ` — ${snapRes.data.error}` : ""}. Crawler rules come from robots.txt (registry{" "}
            {snap?.success ? snap.data.robots.registryVersion : "?"}); they show what the site publishes, not what each AI actually fetched.
          </p>
          {snap?.success ? (
            <table data-testid="ws-snapshots">
              <thead>
                <tr>
                  <th>Page</th>
                  <th>Our fetch</th>
                  <th>Words · headings</th>
                  <th>Structured data</th>
                  {ENGINES.map((e) => (
                    <th key={e}>{e} search crawler</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {snap.data.pages.map((p) => (
                  <tr key={p.url}>
                    <td style={{ wordBreak: "break-all" }}>
                      <a href={p.url} target="_blank" rel="noreferrer">
                        {p.url}
                      </a>
                      <div className="muted">
                        {p.kind} · {p.reason}
                        {p.title ? ` · “${p.title}”` : ""}
                      </div>
                    </td>
                    <td>
                      {p.error ? <span className="error">{p.error}</span> : `HTTP ${p.status}`}
                      {p.finalUrl && p.finalUrl !== p.url ? <div className="muted">→ {p.finalUrl}</div> : null}
                      {p.truncated ? <div className="muted">cut at 2 MB</div> : null}
                      {p.metaRobots ? <div className="muted">meta robots: {p.metaRobots}</div> : null}
                    </td>
                    <td>
                      {p.wordCount} · {p.headings.length}
                      {p.textExcerpt ? (
                        <details>
                          <summary>Text</summary>
                          <p style={{ whiteSpace: "pre-wrap" }}>{p.textExcerpt}</p>
                        </details>
                      ) : null}
                    </td>
                    <td>
                      {p.jsonLdTypes.length ? p.jsonLdTypes.join(", ") : <span className="muted">none</span>}
                      {p.jsonLdErrors ? <div className="error">{p.jsonLdErrors} invalid JSON-LD block(s)</div> : null}
                      {p.microdataTypes.length ? <div className="muted">microdata: {p.microdataTypes.map((t) => t.replace(/^https?:\/\/schema.org\//, "")).join(", ")}</div> : null}
                    </td>
                    {ENGINES.map((_, i) => {
                      const tokens = CRAWLERS.filter((c) => c.engine === i);
                      const search = tokens.find((c) => c.purpose === "search")!;
                      const perm = p.permissions[search.token];
                      return (
                        <td key={i} title={tokens.map((c) => `${c.token} (${c.purpose}): ${p.permissions[c.token]?.reason ?? "?"}`).join("\n")}>
                          {perm ? (
                            <>
                              <span className={perm.verdict === "blocked" ? "error" : undefined}>{VERDICT[perm.verdict]}</span>
                              <div className="muted">{search.token}</div>
                            </>
                          ) : (
                            "—"
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}
        </>
      ) : null}

      {testsRan ? (
        <>
          <h2>4. Can each AI find and read these pages?</h2>
          <p className="muted">
            Search: a fresh branded question per page to each engine&apos;s own search; found only if the page itself is among its results or citations (not the home page, not
            another site&apos;s copy). Reading: each engine&apos;s own page-reading tool opens the URL; read only if two passages it returns are on the page. No tool activity means
            unconfirmed, never a failure. Key facts: it also lists the prices, phone numbers, hours and products it can get from the page; we score them against
            what a visitor sees (our browser copy, section 5). Missing a fact that loads only with JavaScript, or most of them, makes it partly read. API
            tools, not the consumer apps.
          </p>
          <p className="muted">
            {testRes.map((t, i) => (t.data ? `${["ChatGPT search", "Claude search", "Gemini search", "ChatGPT read", "Claude read", "Gemini read"][i]}: ${t.data.status}` : null)).filter(Boolean).join(" · ")}
            {frRes.data ? ` · combined: ${frRes.data.status}` : " · combined: waiting for all six"}
          </p>
          {fr?.success ? (
            <table data-testid="ws-findread">
              <thead>
                <tr>
                  <th>Page</th>
                  {ENGINES.map((e, i) => (
                    <th key={e}>
                      {e}
                      <div className="muted">
                        {fr.data.foundAndRead[i] === null ? "not tested" : `${fr.data.foundAndRead[i]} of ${fr.data.selectedPageCount} found & read`}
                      </div>
                      {fr.data.keyFacts?.[i] ? (
                        <div className="muted">
                          {fr.data.keyFacts[i]!.got} of {fr.data.keyFacts[i]!.of} key facts on {fr.data.keyFacts[i]!.pages} pages read
                        </div>
                      ) : null}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {fr.data.pages.map((p) => (
                  <tr key={p.url}>
                    <td style={{ wordBreak: "break-all" }}>
                      {p.url}
                      <div className="muted">{p.title ?? p.reason}</div>
                      {p.js && p.js.verdict !== "same" ? <div className="muted">JavaScript check: {p.js.label}</div> : null}
                    </td>
                    {p.results.map((r, i) => {
                      const s = searches[i]?.success ? searches[i]!.data.pages.find((x) => x.url === p.url) : undefined;
                      const rd = reads[i]?.success ? reads[i]!.data.pages.find((x) => x.url === p.url) : undefined;
                      return (
                        <td key={i}>
                          <strong>{r.label}</strong>
                          {r.note ? <div className="muted">{r.note}</div> : null}
                          <details>
                            <summary>Evidence</summary>
                            {s ? (
                              <p>
                                <em>Search:</em> {s.reason}
                                {s.searchQueries.length ? <> Queries: {s.searchQueries.join(" · ")}.</> : null}
                                {s.matchedUrl ? <> Matched {s.matchedUrl}.</> : null}
                              </p>
                            ) : null}
                            {rd ? (
                              <>
                                <p>
                                  <em>Reading:</em> {rd.reason} {rd.reference?.fallback ? <>Passages checked against our earlier copy from {rd.reference.fetchedAt.slice(0, 16).replace("T", " ")} UTC (this run&apos;s fetch failed). </> : null}
                                  {!rd.reference ? <>No copy of the page to check passages against. </> : null}
                                  Tool attempts: {rd.attempts.length ? rd.attempts.map((a) => `${a.url} (${a.status}${a.detail ? `, ${a.detail}` : ""})`).join("; ") : "none"}. Provenance: {rd.provenance}.
                                </p>
                                {rd.facts?.length ? (
                                  <p>
                                    <em>Facts it listed:</em> {rd.facts.map((f) => `${f.kind}: ${f.text}`).join(" · ")}
                                  </p>
                                ) : null}
                                {r.extraction?.missed.length ? (
                                  <p>
                                    <em>Missed (from {r.extraction.answerKey === "browser" ? "what a visitor sees in our browser" : "our plain copy"}):</em>{" "}
                                    {r.extraction.missed.map((f) => `${f.text}${f.jsOnly ? " (JavaScript only)" : ""}`).join(" · ")}
                                  </p>
                                ) : null}
                                {rd.passages.length ? (
                                  <ul>
                                    {rd.passages.map((x, j) => (
                                      <li key={j}>
                                        {x.onPage ? "✓" : "✕"} “{x.text}”
                                      </li>
                                    ))}
                                  </ul>
                                ) : null}
                              </>
                            ) : null}
                          </details>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}
        </>
      ) : null}

      {jsRes.data ? (
        <>
          <h2>5. Does each page need JavaScript? (our check)</h2>
          <p className="muted">
            We load each page in our own headless browser so its scripts run, and compare its text with our plain fetch, which is what a reader that doesn&apos;t
            run scripts gets. ChatGPT&apos;s and Claude&apos;s page readers generally don&apos;t run scripts; Google can. This explains reading results; it is our
            diagnostic, never an AI&apos;s view. The browser copy is also the answer key for the key facts each AI extracts in section 4.
          </p>
          <p className="muted">
            Status: {jsRes.data.status}
            {jsRes.data.error ? <span className="error"> — {jsRes.data.error}</span> : null}
            {js?.success ? ` · ${Object.entries(js.data.counts).filter(([, n]) => n).map(([v, n]) => `${n} ${JS_SHORT[v as keyof typeof JS_SHORT]}`).join(" · ")}` : null}
          </p>
          {js?.success ? (
            <table data-testid="ws-jscheck">
              <thead>
                <tr>
                  <th>Page</th>
                  <th>Result</th>
                  <th>Words: plain / with scripts</th>
                  <th>Evidence</th>
                </tr>
              </thead>
              <tbody>
                {js.data.pages.map((p) => (
                  <tr key={p.url}>
                    <td style={{ wordBreak: "break-all" }}>
                      {p.url}
                      {p.rendered.title ? <div className="muted">{p.rendered.title}</div> : null}
                    </td>
                    <td>
                      <strong className={p.verdict === "key_facts_need_js" || p.verdict === "content_needs_js" ? "error" : undefined}>{p.label}</strong>
                      <div className="muted">{p.reason}</div>
                    </td>
                    <td>
                      {p.verdict === "not_checked" && !p.renderedWords ? "—" : `${p.rawWords} / ${p.renderedWords}`}
                      {p.addedWords ? <div className="muted">+{p.addedWords} only with scripts</div> : null}
                    </td>
                    <td>
                      <details>
                        <summary>Details</summary>
                        <p>
                          Our browser: {p.rendered.status ?? "no response"}
                          {p.rendered.error ? ` (${p.rendered.error})` : ""} in {(p.rendered.durationMs / 1000).toFixed(1)} s; requests fetched {p.rendered.requests.fetched}, refused{" "}
                          {p.rendered.requests.refused}, skipped {p.rendered.requests.skipped}.
                          {p.rendered.finalUrl && p.rendered.finalUrl !== p.url ? <> Ended at {p.rendered.finalUrl}.</> : null}
                        </p>
                        {p.raw?.fallback ? <p>Compared with our earlier plain copy from {p.raw.fetchedAt?.slice(0, 16).replace("T", " ")} UTC (this run&apos;s plain fetch failed).</p> : null}
                        {p.keyFactsOnlyRendered.length ? (
                          <>
                            <p>
                              <em>Facts only with scripts:</em>
                            </p>
                            <ul>
                              {p.keyFactsOnlyRendered.map((f, j) => (
                                <li key={j}>
                                  {f.kind}: <strong>{f.text}</strong> — “{f.line}”
                                </li>
                              ))}
                            </ul>
                          </>
                        ) : null}
                        {p.onlyRendered.length ? (
                          <>
                            <p>
                              <em>Text only with scripts (first {p.onlyRendered.length} lines):</em>
                            </p>
                            <ul>
                              {p.onlyRendered.map((l, j) => (
                                <li key={j}>{l}</li>
                              ))}
                            </ul>
                          </>
                        ) : null}
                      </details>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}
        </>
      ) : null}
    </main>
  );
}
