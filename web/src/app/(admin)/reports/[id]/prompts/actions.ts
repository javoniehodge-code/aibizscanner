"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { parsePromptSetForm } from "@/lib/prompt-sets";
import { parseServiceLines } from "@/lib/service-lines";
import { EnqueueError, enqueueStage } from "@/lib/stage-runs";
import { createClient } from "@/lib/supabase/server";

export type ApproveState = { errors: string[] };

const text = (f: FormData, k: string) => {
  const v = f.get(k);
  return typeof v === "string" ? v : "";
};

/**
 * Saves the form as a new, approved prompt set version (approved sets are frozen) and starts the prompt analysis:
 * queues pa_prompt_set with the set and the business; the worker queues the engines, reading and assembly after it.
 */
export async function approveAndRun(_prev: ApproveState, form: FormData): Promise<ApproveState> {
  const admin = await requireAdmin();
  const reportId = z.uuid().parse(form.get("reportId"));
  const cap = Number(text(form, "cap"));
  if (!Number.isFinite(cap) || cap <= 0 || cap > 50) return { errors: ["Spending cap must be a number of dollars between 0 and 50."] };
  const parsed = parsePromptSetForm({
    groups: text(form, "groups"),
    prompts: text(form, "prompts"),
    city: text(form, "city"),
    region: text(form, "region"),
    country: text(form, "country"),
    timezone: text(form, "timezone"),
  });
  if (!parsed.ok) return { errors: parsed.errors };

  const db = await createClient();
  const { data: report, error } = await db
    .from("report")
    .select("id, spending_cap_usd, business:business_id (name, aliases, domains, location, category)")
    .eq("id", reportId)
    .single();
  if (error) throw new Error(error.message);
  const biz = report.business;
  if (!biz) return { errors: ["This report has no business."] };

  if (Number(report.spending_cap_usd) !== cap) {
    const upd = await db.from("report").update({ spending_cap_usd: cap }).eq("id", reportId);
    if (upd.error) throw new Error(upd.error.message);
  }

  const { data: last, error: lastError } = await db
    .from("prompt_set")
    .select("version")
    .eq("report_id", reportId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (lastError) throw new Error(lastError.message);
  const approvedAt = new Date().toISOString();
  const { data: set, error: insertError } = await db
    .from("prompt_set")
    .insert({
      report_id: reportId,
      version: (last?.version ?? 0) + 1,
      groups: parsed.value.groups,
      prompts: parsed.value.prompts,
      customer_location: parsed.value.location,
      approved_by: admin.userId,
      approved_at: approvedAt,
    })
    .select("id, version")
    .single();
  if (insertError) throw new Error(insertError.message);

  const domains = biz.domains.length ? biz.domains : [];
  try {
    await enqueueStage(db, reportId, "pa_prompt_set", {
      promptSet: { id: set.id, version: set.version, approvedAt },
      target: { name: biz.name, aliases: biz.aliases, domains, location: biz.location, category: biz.category },
      location: parsed.value.location,
      groups: parsed.value.groups,
      prompts: parsed.value.prompts,
    });
  } catch (e) {
    if (e instanceof EnqueueError) return { errors: [`Prompt set v${set.version} was saved and approved, but the run could not start: ${e.message}`] };
    throw e;
  }
  revalidatePath(`/reports/${reportId}`, "layout");
  redirect(`/reports/${reportId}/prompt-analysis`);
}

export type LinesState = { errors: string[]; saved?: boolean };

/**
 * Saves the business's service lines (which questions belong to each) by queueing pa_lines. No question is asked
 * again; its new run queues wp_pages (an optional input), which rebuilds the citation maps per line.
 */
export async function saveServiceLines(_prev: LinesState, form: FormData): Promise<LinesState> {
  await requireAdmin();
  const reportId = z.uuid().parse(form.get("reportId"));
  const db = await createClient();
  const { data: set, error } = await db.from("prompt_set").select("prompts").eq("report_id", reportId).order("version", { ascending: false }).limit(1).maybeSingle();
  if (error) throw new Error(error.message);
  if (!set) return { errors: ["Approve a prompt set first."] };
  const ids = z.array(z.object({ id: z.string() }).loose()).parse(set.prompts).map((p) => p.id);
  const parsed = parseServiceLines(text(form, "lines"), ids);
  if (!parsed.ok) return { errors: parsed.errors };
  try {
    await enqueueStage(db, reportId, "pa_lines", parsed.value);
  } catch (e) {
    if (e instanceof EnqueueError) return { errors: [e.message] };
    throw e;
  }
  revalidatePath(`/reports/${reportId}`, "layout");
  return { errors: [], saved: true };
}

/**
 * Chooses the two competitors to compare (or, left empty, goes back to the two AI recommends most) by queueing
 * cp_choice; its new run queues the comparison again (cp_pages reads it).
 */
export async function saveCompetitors(_prev: LinesState, form: FormData): Promise<LinesState> {
  await requireAdmin();
  const reportId = z.uuid().parse(form.get("reportId"));
  const names = text(form, "competitors")
    .split(/\n|,/)
    .map((n) => n.trim())
    .filter(Boolean);
  if (names.length !== 0 && names.length !== 2) return { errors: ["Give two names separated by a comma, or leave it empty for the automatic choice."] };
  const db = await createClient();
  try {
    await enqueueStage(db, reportId, "cp_choice", { names });
  } catch (e) {
    if (e instanceof EnqueueError) return { errors: [e.message] };
    throw e;
  }
  revalidatePath(`/reports/${reportId}`, "layout");
  return { errors: [], saved: true };
}
