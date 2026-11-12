import "server-only";
import { executeRun, registry, type RunOutcome } from "@/engine";
import type { ServiceClient } from "@/lib/supabase/service";
import { supabaseRunStore, toClaimedRun } from "./supabase-store";

export type TickSummary = {
  recoveredExpiredLeases: number;
  runs: RunOutcome[];
  stoppedBecause: "queue_empty" | "time_budget";
  elapsedMs: number;
};

/**
 * One worker tick: recover runs whose lease expired, then claim and execute due runs one at a time
 * until the queue is empty or the time budget is used up. Only runs whose own timeout fits in the
 * remaining budget are claimed, so a tick never outlives the platform's function time limit.
 */
export async function runTick(db: ServiceClient, budgetMs: number, safetyMarginMs = 5_000): Promise<TickSummary> {
  const started = Date.now();
  const store = supabaseRunStore(db);
  const recovered = await db.rpc("recover_expired_stage_runs");
  if (recovered.error) throw new Error(`recover expired leases: ${recovered.error.message}`);

  const runs: RunOutcome[] = [];
  for (;;) {
    const remaining = budgetMs - (Date.now() - started) - safetyMarginMs;
    if (remaining < 1_000) return summary("time_budget");
    const claimed = await db.rpc("claim_stage_runs", { p_limit: 1, p_max_timeout_ms: Math.floor(remaining) });
    if (claimed.error) throw new Error(`claim: ${claimed.error.message}`);
    const row = claimed.data[0];
    if (!row) return summary("queue_empty");
    runs.push(await executeRun(store, registry, toClaimedRun(row)));
  }

  function summary(stoppedBecause: TickSummary["stoppedBecause"]): TickSummary {
    return { recoveredExpiredLeases: recovered.data ?? 0, runs, stoppedBecause, elapsedMs: Date.now() - started };
  }
}
