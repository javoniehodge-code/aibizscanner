import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { CRAWLERS } from "@/engine/modules/website/logic/robots";
import { discovery, snapshots } from "@/engine/modules/website/schemas";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_PAGE_CAP } from "@/lib/website-pages";
import { ApprovePagesForm, FindPagesForm, type PageRow } from "./forms";

export const metadata = { title: "Website pages — AIBizScanner internal" };
export const dynamic = "force-dynamic";

const WS_STAGES = ["ws_discover", "ws_page_set", "ws_snapshot"];
const ENGINES = ["ChatGPT", "Claude", "Gemini"];
const VERDICT = { allowed: "Allowed", blocked: "Blocked", unconfirmed: "Unconfirmed" } as const;

export default async function WebsitePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const db = await createClient();
  const latest = (stage: string) =>
    db.from("stage_run").select("id, version, status, error, output, finished_at").eq("report_id", id).eq("stage", stage).order("version", { ascending: false }).limit(1).maybeSingle();
  const [reportRes, busyRes, discRes, snapRes, setRes] = await Promise.all([
    db.from("report").select("id, version, business:business_id (name, website)").eq("id", id).maybeSingle(),
    db.from("stage_run").select("id", { count: "exact", head: true }).eq("report_id", id).in("stage", WS_STAGES).in("status", ["queued", "running"]),
    latest("ws_discover"),
    latest("ws_snapshot"),
    db.from("website_page_set").select("version, pages, approved_at").eq("report_id", id).order("version", { ascending: false }).limit(1).maybeSingle(),
  ]);
  for (const r of [reportRes, busyRes, discRes, snapRes, setRes]) if (r.error) throw new Error(r.error.message);
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
    </main>
  );
}
