import "server-only";
import { inputsHash, instructionRef, registry, type JsonValue, type StageInput } from "@/engine";
import type { Json } from "@/lib/database.types";
import type { createClient } from "@/lib/supabase/server";
import type { ServiceClient } from "@/lib/supabase/service";

/** The signed-in admin's client (RLS applies) or, for the worker's automatic queuing, the service client. */
type Db = Awaited<ReturnType<typeof createClient>> | ServiceClient;

export class EnqueueError extends Error {}

/**
 * Queues a run (or rerun) of one stage for one report, as the signed-in admin (RLS applies).
 * Inputs are the latest finished (done or partial) run of each upstream stage; a rerun creates a new version
 * and marks the latest runs of downstream stages stale. Nothing is overwritten.
 */
export async function enqueueStage(db: Db, reportId: string, stageId: string, rawParams: unknown = {}) {
  const stage = registry.get(stageId);
  if (!stage) throw new EnqueueError(`Unknown stage: ${stageId}`);
  let params;
  try {
    params = stage.parseParams(rawParams);
  } catch (e) {
    throw new EnqueueError(`Invalid parameters for ${stageId}: ${e instanceof Error ? e.message : String(e)}`);
  }

  const inputs: StageInput[] = [];
  for (const upstream of stage.inputs) {
    const { data, error } = await (db as ServiceClient)
      .from("stage_run")
      .select("id, stage, output, output_hash")
      .eq("report_id", reportId)
      .eq("stage", upstream)
      .in("status", ["done", "partial"])
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new EnqueueError(`Run "${upstream}" first: ${stageId} reads its output.`);
    inputs.push({ runId: data.id, stage: data.stage, output: data.output as JsonValue, outputHash: data.output_hash });
  }

  // The exact instruction versions this run will use: recorded on the run and part of its inputs hash.
  const instructions = await Promise.all((stage.instructions ?? []).map(instructionRef));
  const { data, error } = await (db as ServiceClient).rpc("enqueue_stage_run", {
    p_report_id: reportId,
    p_stage: stageId,
    p_params: params as Json,
    p_inputs_hash: await inputsHash(stageId, params, inputs, instructions),
    p_instruction_refs: instructions as unknown as Json,
    p_input_run_ids: inputs.map((i) => i.runId),
    p_timeout_ms: stage.timeoutMs,
    p_max_attempts: stage.maxAttempts,
    p_downstream_stages: registry.downstreamOf(stageId),
  });
  if (error) throw new EnqueueError(error.message);
  return data;
}

/**
 * After a run finishes, queues the stages marked autoRun that read from it, once every input stage has a finished,
 * non-stale latest run and none is still queued or running. A stage is not queued again for inputs it already ran on
 * (whatever that run's outcome), so a failure never loops.
 */
export async function queueReadyDownstream(db: ServiceClient, reportId: string, finishedStage: string): Promise<string[]> {
  const queued: string[] = [];
  for (const stage of registry.stages.filter((s) => s.autoRun && s.inputs.includes(finishedStage))) {
    const names = [...stage.inputs, stage.id];
    const { data: runs, error } = await db
      .from("stage_run")
      .select("id, stage, version, status, input_run_ids")
      .eq("report_id", reportId)
      .in("stage", names)
      .order("version", { ascending: false });
    if (error) throw new Error(error.message);
    const latest = (s: string) => runs.find((r) => r.stage === s);
    const busy = (s: string) => runs.some((r) => r.stage === s && (r.status === "queued" || r.status === "running"));
    if (names.some(busy)) continue;
    const inputs = stage.inputs.map(latestFinished);
    if (inputs.some((r) => !r)) continue;
    const ids = inputs.map((r) => r!.id);
    const { data: stale, error: staleError } = await db.from("stage_run_stale").select("stage_run_id").in("stage_run_id", ids);
    if (staleError) throw new Error(staleError.message);
    if (stale.length) continue;
    const own = latest(stage.id);
    if (own && ids.every((id) => own.input_run_ids.includes(id))) continue;
    try {
      await enqueueStage(db, reportId, stage.id, {});
      queued.push(stage.id);
    } catch (e) {
      if (!(e instanceof EnqueueError)) throw e; // e.g. another tick queued it first
    }

    function latestFinished(s: string) {
      return runs!.find((r) => r.stage === s && (r.status === "done" || r.status === "partial"));
    }
  }
  return queued;
}
