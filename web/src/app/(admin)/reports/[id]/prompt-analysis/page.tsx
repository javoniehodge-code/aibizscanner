import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { assembledSection } from "@/engine/modules/prompt-analysis/stages";
import { createClient } from "@/lib/supabase/server";
import { formatUsd } from "@/lib/format";

export const metadata = { title: "Prompt analysis — AIBizScanner internal" };

const ENGINES = ["ChatGPT", "Claude", "Gemini"];
const STAGES = [
  ["pa_prompt_set", "Prompt set"],
  ["pa_answers_chatgpt", "ChatGPT answers"],
  ["pa_answers_claude", "Claude answers"],
  ["pa_answers_gemini", "Gemini answers"],
  ["pa_extract", "Reading answers"],
  ["pa_assemble", "Assembling"],
] as const;
const STATUS_LABEL = { R: "recommended", M: "mentioned", X: "excluded" } as const;
const STATUS_COLOR = { R: "#067647", M: "#6b6b7b", X: "#b42318" } as const;

export default async function PromptAnalysisPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const db = await createClient();
  const [reportRes, runsRes, rollRes] = await Promise.all([
    db.from("report").select("id, version, spending_cap_usd, business:business_id (name)").eq("id", id).maybeSingle(),
    db
      .from("stage_run_overview")
      .select("id, stage, version, status, is_latest, is_stale, error, cost_usd, finished_at")
      .eq("report_id", id)
      .in("stage", STAGES.map((s) => s[0]))
      .eq("is_latest", true),
    db.from("report_cost_rollup").select("cost_usd").eq("report_id", id).maybeSingle(),
  ]);
  for (const r of [reportRes, runsRes, rollRes]) if (r.error) throw new Error(r.error.message);
  const report = reportRes.data;
  if (!report) notFound();
  const runs = runsRes.data ?? [];
  const busy = runs.some((r) => r.status === "queued" || r.status === "running");

  const { data: asmRow, error: asmError } = await db
    .from("stage_run")
    .select("id, version, status, output, finished_at")
    .eq("report_id", id)
    .eq("stage", "pa_assemble")
    .in("status", ["done", "partial"])
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (asmError) throw new Error(asmError.message);
  const parsed = asmRow ? assembledSection.safeParse(asmRow.output) : null;
  const result = parsed?.success ? parsed.data : null;
  const asmStale = runs.find((r) => r.stage === "pa_assemble")?.is_stale ?? false;

  return (
    <main style={{ maxWidth: 1400 }}>
      {busy ? <meta httpEquiv="refresh" content="20" /> : null}
      <p>
        <Link href={`/reports/${id}`}>← Report</Link> · <Link href={`/reports/${id}/prompts`}>Prompt set</Link> ·{" "}
        <Link href={`/reports/${id}/runs`}>Run monitor</Link>
      </p>
      <h1>
        Prompt analysis — {report.business?.name} v{report.version}
      </h1>
      <p>
        Spent <strong data-testid="pa-spent">{formatUsd(rollRes.data?.cost_usd)}</strong> of the {formatUsd(report.spending_cap_usd)} cap.
      </p>

      <ol className="stage-steps" data-testid="pa-progress" style={{ display: "flex", gap: 18, listStyle: "none", padding: 0, flexWrap: "wrap" }}>
        {STAGES.map(([stage, label]) => {
          const r = runs.find((x) => x.stage === stage);
          return (
            <li key={stage} title={r?.error ?? undefined}>
              {label}: <strong>{r ? r.status : "not started"}</strong>
              {r?.is_stale ? <span className="muted"> · stale</span> : null}
              {r && r.cost_usd ? <span className="muted"> · {formatUsd(r.cost_usd)}</span> : null}
            </li>
          );
        })}
      </ol>
      {busy ? <p className="muted">Running — this page refreshes every 20 seconds. Asking every engine takes a few minutes.</p> : null}
      {runs.filter((r) => r.status === "failed" && r.error).map((r) => (
        <p key={r.id} className="error" role="alert">
          {r.stage} failed: {r.error}
        </p>
      ))}

      {!result ? (
        <p>
          {asmRow && parsed && !parsed.success
            ? "The latest assembled result doesn't match the current schema; rerun the analysis."
            : runs.length
              ? "No assembled result yet."
              : "Not run yet. "}
          {!runs.length ? <Link href={`/reports/${id}/prompts`}>Review and approve the prompt set to start.</Link> : null}
        </p>
      ) : (
        <Result result={result} stale={asmStale} finishedAt={asmRow?.finished_at ?? null} />
      )}
    </main>
  );
}

type Result = z.infer<typeof assembledSection>;

function Result({ result, stale, finishedAt }: { result: Result; stale: boolean; finishedAt: string | null }) {
  const pa = result.section;
  const target = result.business.key;
  const names = new Map(pa.businesses.map((b) => [b.v.key, b.v.name]));
  const pages = new Map(pa.pages.map((p) => [p.v.key, p.v]));
  const run = pa.run.v;

  // Per business: how often each engine recommended / mentioned / excluded it.
  const tally = new Map<string, { R: number[]; M: number[]; X: number[]; total: number }>();
  const pageCites = new Map<string, number>();
  for (const q of pa.questions) {
    q.answers.forEach((a, engine) => {
      if (a.v.status !== "ok") return;
      for (const n of a.v.named) {
        const t = tally.get(n.business) ?? { R: [0, 0, 0], M: [0, 0, 0], X: [0, 0, 0], total: 0 };
        t[n.status][engine]! += 1;
        t.total += 1;
        tally.set(n.business, t);
      }
      for (const c of a.v.citations) pageCites.set(c, (pageCites.get(c) ?? 0) + 1);
    });
  }
  const ranked = [...tally.entries()].sort((a, b) => b[1].R.reduce((s, x) => s + x, 0) - a[1].R.reduce((s, x) => s + x, 0) || b[1].total - a[1].total);
  const targetRow = tally.get(target);
  const usablePerEngine = [0, 1, 2].map((e) => pa.questions.filter((q) => q.answers[e]!.v.status === "ok").length);

  return (
    <>
      {stale ? <p className="error">An earlier step was rerun after this result was assembled; it will refresh when the rerun finishes.</p> : null}
      <h2>Summary</h2>
      <p data-testid="pa-summary">
        {run ? `${run.usable} of ${run.expected} answers usable (${run.prompts} questions × 3 engines).` : null}{" "}
        {result.business.name} was recommended in{" "}
        {[0, 1, 2].map((e, i) => (
          <span key={e}>
            {i ? (i === 2 ? " and " : ", ") : ""}
            <strong>
              {targetRow?.R[e] ?? 0} of {usablePerEngine[e]}
            </strong>{" "}
            {ENGINES[e]} answers
          </span>
        ))}
        .{finishedAt ? <span className="muted"> Assembled {finishedAt.slice(0, 16).replace("T", " ")} UTC.</span> : null}
      </p>
      {run?.gaps ? <p className="muted">Unavailable: {run.gaps}.</p> : null}
      <p className="muted">
        Engines: {result.engines.map((e) => `${e.name} (${e.model})`).join(" · ")}
      </p>

      <h2>Who the engines name</h2>
      <table data-testid="pa-businesses">
        <thead>
          <tr>
            <th>Business</th>
            {ENGINES.map((e) => (
              <th key={e}>{e}: recommended / mentioned / excluded</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ranked.slice(0, 25).map(([key, t]) => (
            <tr key={key} style={key === target ? { background: "#f3f3ff" } : undefined}>
              <td>{key === target ? <strong>{names.get(key)} (this business)</strong> : names.get(key)}</td>
              {[0, 1, 2].map((e) => (
                <td key={e}>
                  {t.R[e]} / {t.M[e]} / {t.X[e]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      <h2>Answers by question</h2>
      <table data-testid="pa-questions">
        <thead>
          <tr>
            <th style={{ width: "22%" }}>Question</th>
            {ENGINES.map((e) => (
              <th key={e}>{e}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {pa.questions.map((q) => (
            <tr key={q.question.v.id} style={{ verticalAlign: "top" }}>
              <td>
                <strong>{q.question.v.id}</strong> {q.question.v.text}
                <div className="muted">
                  {pa.groups[q.question.v.group]?.v.name} · {q.question.v.demand}
                </div>
              </td>
              {q.answers.map((a, engine) => (
                <td key={engine}>
                  {a.v.status !== "ok" ? (
                    <span className="muted">Unavailable: {a.v.reason}</span>
                  ) : (
                    <>
                      {a.v.named.length ? (
                        <ol style={{ margin: 0, paddingLeft: 18 }}>
                          {a.v.named.map((n) => (
                            <li key={n.business} title={STATUS_LABEL[n.status]}>
                              <span style={{ color: STATUS_COLOR[n.status], fontWeight: n.business === target ? 700 : 400 }}>
                                {names.get(n.business)} <small>({STATUS_LABEL[n.status]})</small>
                              </span>
                              {pa.firstChoices.some((f) => f.v.prompt === q.question.v.id && f.v.engine === engine && f.v.business === n.business) ? <small> · first choice</small> : null}
                            </li>
                          ))}
                        </ol>
                      ) : (
                        <span className="muted">Names no businesses.</span>
                      )}
                      <div className="muted">
                        {a.v.citations.length} cited page{a.v.citations.length === 1 ? "" : "s"}
                        {a.v.searchObserved ? "" : " · no web search seen"}
                        {a.v.grouped ? " · unordered group" : ""}
                      </div>
                      <details>
                        <summary>Answer</summary>
                        <p style={{ whiteSpace: "pre-wrap" }}>{a.v.text}</p>
                        {a.v.citations.length ? (
                          <ul>
                            {a.v.citations.map((c) => (
                              <li key={c}>
                                <a href={`https://${pages.get(c)?.url ?? ""}`} target="_blank" rel="noreferrer noopener">
                                  {pages.get(c)?.url}
                                </a>{" "}
                                <span className="muted">({pages.get(c)?.category})</span>
                              </li>
                            ))}
                          </ul>
                        ) : null}
                        <p className="muted">Collected {a.v.runAt}</p>
                      </details>
                    </>
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      <h2>Cited pages</h2>
      <table data-testid="pa-pages">
        <thead>
          <tr>
            <th>Page</th>
            <th>Type</th>
            <th>Times cited</th>
          </tr>
        </thead>
        <tbody>
          {[...pages.values()]
            .sort((a, b) => (pageCites.get(b.key) ?? 0) - (pageCites.get(a.key) ?? 0))
            .map((p) => (
              <tr key={p.key}>
                <td style={{ wordBreak: "break-all" }}>{p.url}</td>
                <td>{p.category === "unc" ? "not yet classified" : p.category}</td>
                <td>{pageCites.get(p.key) ?? 0}</td>
              </tr>
            ))}
        </tbody>
      </table>

      <h2>Method</h2>
      {pa.method.map((m) => (
        <p key={m.v.title}>
          <strong>{m.v.title}.</strong> {m.v.text}
        </p>
      ))}
    </>
  );
}
