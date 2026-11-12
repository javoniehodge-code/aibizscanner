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
export const maxDuration = 60;

const TICK_BUDGET_MS = 50_000;

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
