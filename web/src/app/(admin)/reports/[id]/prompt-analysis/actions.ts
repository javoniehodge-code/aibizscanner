"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export type CapState = { message: string | null; error: boolean };

/** Changes the report's spending cap (paid calls stop when estimated spend would pass it). */
export async function updateSpendingCap(_prev: CapState, form: FormData): Promise<CapState> {
  await requireAdmin();
  const reportId = z.uuid().parse(form.get("reportId"));
  const cap = Number(form.get("cap"));
  if (!Number.isFinite(cap) || cap <= 0 || cap > 50) return { message: "Enter a number of dollars between 0 and 50.", error: true };
  const db = await createClient();
  const { error } = await db.from("report").update({ spending_cap_usd: cap }).eq("id", reportId);
  if (error) throw new Error(error.message);
  revalidatePath(`/reports/${reportId}`, "layout");
  return { message: `Cap set to $${cap.toFixed(2)}.`, error: false };
}
