import { createClient } from "@supabase/supabase-js";
import { ADMIN, NON_ADMIN } from "./users";

/** Creates the e2e users in the LOCAL Supabase stack and makes one of them an admin. Idempotent. */
export default async function globalSetup() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secret) throw new Error("e2e needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY (local stack)");
  if (!/^http:\/\/(127\.0\.0\.1|localhost):/.test(url)) {
    throw new Error(`Refusing to create test users outside a local Supabase stack: ${url}`);
  }
  const admin = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });

  async function ensureUser(email: string, password: string): Promise<string> {
    const { data: list, error: listError } = await admin.auth.admin.listUsers({ perPage: 1000 });
    if (listError) throw listError;
    const existing = list.users.find((u) => u.email === email);
    if (existing) return existing.id;
    const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    if (error || !data.user) throw error ?? new Error("createUser returned no user");
    return data.user.id;
  }

  const adminId = await ensureUser(ADMIN.email, ADMIN.password);
  await ensureUser(NON_ADMIN.email, NON_ADMIN.password);
  const { error } = await admin.from("admin_user").upsert({ user_id: adminId, note: "e2e" });
  if (error) throw error;
}
