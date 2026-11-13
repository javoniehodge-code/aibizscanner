import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatDuration, formatUsd } from "@/lib/format";
import { createReport } from "./actions";

export const metadata = { title: "Reports — AIBizScanner internal" };

export default async function ReportsPage() {
  const db = await createClient();
  const [reports, businesses, rollups] = await Promise.all([
    db.from("report").select("id, version, status, created_at, business:business_id (id, name)").order("created_at", { ascending: false }),
    db.from("business").select("id, name").order("name"),
    db.from("report_cost_rollup").select("*"),
  ]);
  for (const r of [reports, businesses, rollups]) if (r.error) throw new Error(r.error.message);
  const rollupById = new Map((rollups.data ?? []).map((r) => [r.report_id, r]));

  return (
    <main>
      <h1>Reports</h1>
      {businesses.data && businesses.data.length > 0 ? (
        <form action={createReport} style={{ display: "flex", gap: 8, alignItems: "end", maxWidth: 560 }}>
          <div style={{ flex: 1 }}>
            <label htmlFor="businessId">New test report for</label>
            <select id="businessId" name="businessId" required>
              {businesses.data.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
          <button type="submit">Create report</button>
        </form>
      ) : (
        <p className="muted">
          <Link href="/businesses/new">Add a business</Link> first.
        </p>
      )}
      <table style={{ marginTop: 24 }}>
        <thead>
          <tr>
            <th>Business</th>
            <th>Version</th>
            <th>Status</th>
            <th>Stage runs</th>
            <th>Failed</th>
            <th>Time</th>
            <th>Cost (est.)</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {(reports.data ?? []).map((r) => {
            const roll = rollupById.get(r.id);
            return (
              <tr key={r.id} data-testid="report-row">
                <td>{r.business?.name ?? "—"}</td>
                <td>v{r.version}</td>
                <td>{r.status}</td>
                <td>{roll?.stage_runs ?? 0}</td>
                <td>{roll?.failed_runs ?? 0}</td>
                <td>{formatDuration(roll?.duration_ms)}</td>
                <td>{formatUsd(roll?.cost_usd)}</td>
                <td>
                  <Link href={`/reports/${r.id}/runs`}>Run monitor</Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </main>
  );
}
