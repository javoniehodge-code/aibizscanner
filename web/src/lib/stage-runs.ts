import "server-only";
import { inputsHash, instructionRef, registry, type JsonValue, type StageInput } from "@/engine";
import type { Json } from "@/lib/database.types";
import type { createClient } from "@/lib/supabase/server";

type Db = Awaited<ReturnType<typeof createClient>>;

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
    const { data, error } = await db
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
  const { data, error } = await db.rpc("enqueue_stage_run", {
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
