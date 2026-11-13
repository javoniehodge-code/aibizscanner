import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { registry } from "@/engine";
import { createClient } from "@/lib/supabase/server";
import { formatCount, formatDuration, formatUsd } from "@/lib/format";
import { ProcessQueueButton, StageRunButton } from "./run-controls";

export const metadata = { title: "Run monitor — AIBizScanner internal" };

const STATUS_COLOR: Record<string, string> = {
  queued: "#6b6b7b",
  running: "#3b3bd6",
  done: "#067647",
  partial: "#b54708",
  failed: "#b42318",
};

function Status({ status, stale }: { status: string; stale: boolean }) {
  return (
    <span>
      <strong style={{ color: STATUS_COLOR[status] ?? "inherit" }}>{status}</strong>
      {stale ? (
        <span className="muted" title="An upstream stage was rerun after this run; rerun this stage to refresh it.">
          {" "}
          · stale
        </span>
      ) : null}
    </span>
  );
}

/** The stage's default parameters as JSON, or null when it has none (it is started from its own screen). */
function defaultParams(stage: { parseParams(raw: unknown): unknown }): string | null {
  try {
    return JSON.stringify(stage.parseParams({}));
  } catch {
    return null;
  }
}

export default async function RunMonitorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const db = await createClient();
  const report = await db.from("report").select("id, version, status, spending_cap_usd, business:business_id (name)").eq("id", id).maybeSingle();
  if (report.error) throw new Error(report.error.message);
  if (!report.data) notFound();

  const [runsRes, rollupRes, pricingRes] = await Promise.all([
    db.from("stage_run_overview").select("*").eq("report_id", id).order("created_at", { ascending: false }),
    db.from("report_cost_rollup").select("*").eq("report_id", id).maybeSingle(),
    db.from("pricing").select("id, provider, model, version"),
  ]);
  for (const r of [runsRes, rollupRes, pricingRes]) if (r.error) throw new Error(r.error.message);
  const runs = runsRes.data ?? [];
  const runIds = runs.map((r) => r.id).filter((x): x is string => Boolean(x));
  const [usageRes, llmRes] = runIds.length
    ? await Promise.all([
        db.from("usage_event").select("*").in("stage_run_id", runIds).order("created_at"),
        db.from("llm_call").select("id, stage_run_id, attempt, instruction_id, instruction_version, model, served_model, valid, error, duration_ms").in("stage_run_id", runIds).order("created_at"),
      ])
    : [{ data: [], error: null }, { data: [], error: null }];
  if (usageRes.error) throw new Error(usageRes.error.message);
  if (llmRes.error) throw new Error(llmRes.error.message);
  const pricingById = new Map((pricingRes.data ?? []).map((p) => [p.id, p]));
  const roll = rollupRes.data;

  return (
    <main style={{ maxWidth: 1280 }}>
      <p>
        <Link href="/reports">← Reports</Link>
      </p>
      <h1>
        Run monitor — {report.data.business?.name} v{report.data.version}
      </h1>
      <p data-testid="report-totals">
        Total estimated cost <strong>{formatUsd(roll?.cost_usd)}</strong> of {formatUsd(report.data.spending_cap_usd)} cap ·
        time {formatDuration(roll?.duration_ms)} · {formatCount(roll?.tokens_in)} tokens in / {formatCount(roll?.tokens_out)} out ·{" "}
        {formatCount(roll?.search_calls)} search calls · {roll?.failed_runs ?? 0} failed runs
      </p>
      <p>
        <Link href={`/reports/${id}/prompt-analysis`}>Prompt analysis results</Link> · <Link href={`/reports/${id}/prompts`}>Prompt set</Link>
      </p>
      <ProcessQueueButton reportId={id} />
      <p className="muted">
        The worker also runs every minute via Supabase pg_cron once it is configured (docs/build/milestone-1-setup.md). “Process queue now” only runs short stages; AI engine stages need the scheduled worker (up to 5 minutes each).
      </p>

      <h2>Stages</h2>
      <table>
        <thead>
          <tr>
            <th>Stage</th>
            <th>Latest</th>
            <th>Attempts</th>
            <th>Time</th>
            <th>Tokens in / out</th>
            <th>Search</th>
            <th>Cost (est.)</th>
            <th>Error</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {registry.stages.map((stage) => {
            const latest = runs.find((r) => r.stage === stage.id && r.is_latest);
            const busy = latest?.status === "queued" || latest?.status === "running";
            return (
              <tr key={stage.id} data-testid={`stage-${stage.id}`}>
                <td>
                  <strong>{stage.label}</strong>
                  <div className="muted">
                    <code>{stage.id}</code>
                    {stage.inputs.length ? ` · reads ${stage.inputs.join(", ")}` : ""}
                  </div>
                </td>
                <td>
                  {latest ? (
                    <>
                      <Status status={latest.status ?? ""} stale={Boolean(latest.is_stale)} /> v{latest.version}
                    </>
                  ) : (
                    <span className="muted">never run</span>
                  )}
                </td>
                <td>{latest ? `${latest.attempt} / ${latest.max_attempts}` : "—"}</td>
                <td>{formatDuration(latest?.duration_ms)}</td>
                <td>
                  {latest ? `${formatCount(latest.tokens_in)} / ${formatCount(latest.tokens_out)}` : "—"}
                </td>
                <td>{latest ? formatCount(latest.search_calls) : "—"}</td>
                <td data-testid={`cost-${stage.id}`}>{latest ? formatUsd(latest.cost_usd) : "—"}</td>
                <td className="error" style={{ maxWidth: 260 }}>
                  {latest?.error ?? ""}
                </td>
                <td style={{ minWidth: 170 }}>
                  {busy ? (
                    <span className="muted">in queue</span>
                  ) : defaultParams(stage) === null ? (
                    <Link href={`/reports/${id}/prompts`}>Start from the prompt set page</Link>
                  ) : (
                    <StageRunButton
                      reportId={id}
                      stage={stage.id}
                      label={latest ? "Rerun this stage" : "Run"}
                      defaultParams={defaultParams(stage) ?? "{}"}
                    />
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <h2>All runs (every version is kept)</h2>
      {runs.length === 0 ? (
        <p className="muted">No runs yet.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Stage</th>
              <th>Version</th>
              <th>Status</th>
              <th>Attempts</th>
              <th>Started / finished</th>
              <th>Time</th>
              <th>Cost (est.)</th>
              <th>Pricing</th>
              <th>Inputs hash</th>
              <th>Instructions</th>
              <th>Paid calls</th>
            </tr>
          </thead>
          <tbody>
            {runs.map((r) => {
              const calls = (usageRes.data ?? []).filter((u) => u.stage_run_id === r.id);
              const llmCalls = (llmRes.data ?? []).filter((c) => c.stage_run_id === r.id);
              const refs = (Array.isArray(r.instruction_refs) ? r.instruction_refs : []) as { id: string; version: number }[];
              return (
                <tr key={r.id} data-testid="run-history-row">
                  <td>
                    <code>{r.stage}</code>
                  </td>
                  <td>v{r.version}</td>
                  <td>
                    <Status status={r.status ?? ""} stale={Boolean(r.is_stale)} />
                    {r.error ? <div className="error">{r.error}</div> : null}
                  </td>
                  <td>
                    {r.attempt} / {r.max_attempts}
                  </td>
                  <td className="muted">
                    {r.started_at ? new Date(r.started_at).toISOString().replace("T", " ").slice(0, 19) : "—"}
                    <br />
                    {r.finished_at ? new Date(r.finished_at).toISOString().replace("T", " ").slice(0, 19) : "—"}
                  </td>
                  <td>{formatDuration(r.duration_ms)}</td>
                  <td>{formatUsd(r.cost_usd)}</td>
                  <td className="muted">
                    {(r.pricing_ids ?? [])
                      .map((pid) => pricingById.get(pid))
                      .filter(Boolean)
                      .map((p) => `${p?.provider}/${p?.model} v${p?.version}`)
                      .join(", ") || "—"}
                  </td>
                  <td>
                    <code title={r.inputs_hash ?? ""}>{(r.inputs_hash ?? "").slice(0, 10)}</code>
                  </td>
                  <td>
                    {refs.length === 0 ? (
                      <span className="muted">none</span>
                    ) : (
                      refs.map((i) => (
                        <div key={i.id}>
                          <code>
                            {i.id} v{i.version}
                          </code>
                        </div>
                      ))
                    )}
                    {llmCalls.length > 0 ? (
                      <details>
                        <summary>
                          {llmCalls.length} LLM call{llmCalls.length === 1 ? "" : "s"} · {llmCalls.filter((c) => !c.valid).length} invalid
                        </summary>
                        <ul style={{ paddingLeft: 16, margin: 0 }}>
                          {llmCalls.map((c) => (
                            <li key={c.id}>
                              attempt {c.attempt}: {c.instruction_id} v{c.instruction_version} · {c.served_model ?? c.model} · {formatDuration(c.duration_ms)} ·{" "}
                              {c.valid ? "valid" : `invalid: ${c.error ?? ""}`}
                            </li>
                          ))}
                        </ul>
                      </details>
                    ) : null}
                  </td>
                  <td>
                    {calls.length === 0 ? (
                      <span className="muted">none</span>
                    ) : (
                      <details>
                        <summary>{calls.length}</summary>
                        <ul style={{ paddingLeft: 16, margin: 0 }}>
                          {calls.map((c) => (
                            <li key={c.id}>
                              attempt {c.attempt}: {c.provider}/{c.model} · {formatCount(c.tokens_in)}/{formatCount(c.tokens_out)} tok ·{" "}
                              {c.search_calls} search · {formatUsd(c.cost_usd)} · {formatDuration(c.duration_ms)}
                              {c.succeeded ? "" : ` · failed: ${c.error ?? ""}`}
                            </li>
                          ))}
                        </ul>
                      </details>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </main>
  );
}
