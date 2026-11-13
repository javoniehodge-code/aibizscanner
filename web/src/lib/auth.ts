import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export type AdminSession = { userId: string; email: string | null };

/** Signed-in user from a validated JWT, or null. Cached per request. */
export const getUser = cache(async () => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return data.user;
});

/** Redirects to /login when signed out and to /no-access when the user is not in admin_user. */
export async function requireAdmin(): Promise<AdminSession> {
  const user = await getUser();
  if (!user) redirect("/login");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("is_admin");
  if (error) throw new Error(`Admin check failed: ${error.message}`);
  if (data !== true) redirect("/no-access");
  return { userId: user.id, email: user.email ?? null };
}
