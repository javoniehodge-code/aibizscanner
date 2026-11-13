import "server-only";
import { z } from "zod";

/** Server-only secrets. Never prefix these with NEXT_PUBLIC_. Validated on first use. */
const schema = z.object({
  SUPABASE_SECRET_KEY: z.string().min(1),
  CRON_SECRET: z.string().min(32, "CRON_SECRET must be at least 32 characters"),
});

export type ServerEnv = z.infer<typeof schema>;

export function serverEnv(): ServerEnv {
  const result = schema.safeParse({
    SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY,
    CRON_SECRET: process.env.CRON_SECRET,
  });
  if (!result.success) {
    const names = result.error.issues.map((i) => i.path.join(".")).join(", ");
    throw new Error(`Missing or invalid server environment variables: ${names}. See web/README.md.`);
  }
  return result.data;
}
