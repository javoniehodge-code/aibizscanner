"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { businessInput, fieldErrors, formDataToObject, type FieldErrors } from "@/lib/business/schema";

export type BusinessFormState = { errors: FieldErrors; values: Record<string, string> };

const idSchema = z.uuid();

/** Creates a business, or updates it when the form carries an id. Validation runs here, on the server. */
export async function saveBusiness(_prev: BusinessFormState, formData: FormData): Promise<BusinessFormState> {
  await requireAdmin();
  const values = formDataToObject(formData);
  const parsed = businessInput.safeParse(values);
  if (!parsed.success) return { errors: fieldErrors(parsed.error), values };

  const rawId = formData.get("id");
  const id = typeof rawId === "string" && rawId.length > 0 ? idSchema.safeParse(rawId) : null;
  if (id && !id.success) return { errors: { form: "Unknown business." }, values };

  const supabase = await createClient();
  const result = id
    ? await supabase.from("business").update(parsed.data).eq("id", id.data).select("id").single()
    : await supabase.from("business").insert(parsed.data).select("id").single();
  if (result.error || !result.data) {
    return { errors: { form: `Could not save: ${result.error?.message ?? "no row returned"}` }, values };
  }
  revalidatePath("/businesses");
  redirect(`/businesses?saved=${result.data.id}`);
}
