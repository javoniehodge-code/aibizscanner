import { createClient } from "@/lib/supabase/server";
import { gitCommit } from "@/lib/build-info";

export const metadata = { title: "Health — AIBizScanner internal" };

type HealthResult = { ok: true; dbTime: string; latestMigration: string | null; ms: number } | { ok: false; error: string };

async function checkDatabase(): Promise<HealthResult> {
  const started = Date.now();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("health_check");
  if (error) return { ok: false, error: error.message };
  const row = (data ?? {}) as { db_time?: string; latest_migration?: string | null };
  return { ok: true, dbTime: row.db_time ?? "", latestMigration: row.latest_migration ?? null, ms: Date.now() - started };
}

export default async function HealthPage() {
  const db = await checkDatabase();
  const commit = gitCommit();
  return (
    <main>
      <h1>Health</h1>
      <table style={{ maxWidth: 640 }}>
        <tbody>
          <tr>
            <th>Database</th>
            <td data-testid="db-status">
              {db.ok ? (
                <span className="ok">Connected</span>
              ) : (
                <span className="error">Not connected: {db.error}</span>
              )}
            </td>
          </tr>
          {db.ok ? (
            <>
              <tr>
                <th>Database time (live query)</th>
                <td>
                  {db.dbTime} <span className="muted">({db.ms} ms round trip)</span>
                </td>
              </tr>
              <tr>
                <th>Latest applied migration</th>
                <td>{db.latestMigration ?? "unknown"}</td>
              </tr>
            </>
          ) : null}
          <tr>
            <th>Git commit</th>
            <td>
              <code data-testid="git-commit">{commit ?? "unknown"}</code>
            </td>
          </tr>
        </tbody>
      </table>
    </main>
  );
}
