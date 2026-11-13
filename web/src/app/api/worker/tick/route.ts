import { NextResponse, type NextRequest } from "next/server";
import { hasBearerSecret } from "@/lib/bearer";
import { serverEnv } from "@/lib/server-env";
import { createServiceClient } from "@/lib/supabase/service";
import { runTick } from "@/worker/tick";

/**
 * Worker entry point. Called every minute by Supabase pg_cron + pg_net (see supabase/migrations/*_worker_cron.sql)
 * with `Authorization: Bearer $CRON_SECRET`. Claims and runs queued stage runs within the function time limit.
 */
export const dynamic = "force-dynamic";
// Asking an AI engine a dozen questions with web search takes minutes. 300 s is the Vercel limit on every plan with
// Fluid compute (on by default); the tick claims only runs whose timeout fits in what is left.
export const maxDuration = 300;

const TICK_BUDGET_MS = 290_000;

export async function POST(request: NextRequest) {
  let secret: string;
  try {
    secret = serverEnv().CRON_SECRET;
  } catch {
    return NextResponse.json({ error: "Worker is not configured (CRON_SECRET / SUPABASE_SECRET_KEY)" }, { status: 503 });
  }
  if (!hasBearerSecret(request.headers.get("authorization"), secret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const summary = await runTick(createServiceClient(), TICK_BUDGET_MS);
    return NextResponse.json(summary);
  } catch (e) {
    console.error("worker tick failed", e);
    return NextResponse.json({ error: e instanceof Error ? e.message : "tick failed" }, { status: 500 });
  }
}
