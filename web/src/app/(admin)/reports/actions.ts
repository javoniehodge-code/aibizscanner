"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { EnqueueError, enqueueStage } from "@/lib/stage-runs";
import { runTick } from "@/worker/tick";
import { loadExampleReports } from "@/report/documents";

const uuid = z.uuid();

/** Creates the next report version for a business and opens its run monitor. */
export async function createReport(formData: FormData): Promise<void> {
  await requireAdmin();
  const businessId = uuid.parse(formData.get("businessId"));
  const db = await createClient();
  const { data: last, error: lastError } = await db
    .from("report")
    .select("version")
    .eq("business_id", businessId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (lastError) throw new Error(lastError.message);
  const { data, error } = await db
    .from("report")
    .insert({ business_id: businessId, version: (last?.version ?? 0) + 1 })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  revalidatePath("/reports");
  redirect(`/reports/${data.id}/runs`);
}

export type RunActionState = { message: string | null; error: boolean };

/** "Run" / "Rerun this stage": always inserts a new stage_run version. */
export async function queueStage(_prev: RunActionState, formData: FormData): Promise<RunActionState> {
  await requireAdmin();
  const reportId = uuid.parse(formData.get("reportId"));
  const stage = z.string().min(1).parse(formData.get("stage"));
  const rawParams = formData.get("params");
  let params: unknown = {};
  if (typeof rawParams === "string" && rawParams.trim()) {
    try {
      params = JSON.parse(rawParams);
    } catch {
      return { message: "Parameters must be valid JSON.", error: true };
    }
  }
  try {
    const run = await enqueueStage(await createClient(), reportId, stage, params);
    revalidatePath(`/reports/${reportId}/runs`);
    return { message: `Queued ${stage} v${run.version}.`, error: false };
  } catch (e) {
    if (e instanceof EnqueueError) return { message: e.message, error: true };
    throw e;
  }
}

/**
 * Runs one worker tick now, so admins can verify the loop without waiting for the per-minute schedule.
 * Same code path as /api/worker/tick.
 */
export async function processQueueNow(_prev: RunActionState, formData: FormData): Promise<RunActionState> {
  await requireAdmin();
  const reportId = uuid.parse(formData.get("reportId"));
  const summary = await runTick(createServiceClient(), 50_000);
  revalidatePath(`/reports/${reportId}/runs`);
  const counts = summary.runs.map((r) => `${r.stage}: ${r.outcome}`).join(", ");
  return { message: summary.runs.length ? `Processed ${counts}.` : "Queue empty: nothing due to run.", error: false };
}

/** Loads the example reports (fixtures/brownstone.json, fixtures/mvp-miami.json). Running it again changes nothing. */
export async function loadExamples(): Promise<void> {
  await requireAdmin();
  await loadExampleReports(await createClient());
  revalidatePath("/reports");
  redirect("/reports");
}
