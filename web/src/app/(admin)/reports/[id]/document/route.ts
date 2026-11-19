import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { latestReportDocument } from "@/report/documents";
import { TEMPLATE_HTML } from "@/report/generated/template";
import { injectReport } from "@/report/inject";
import { PlacesError, placeDetails, placesKey } from "@/lib/google/places";
import { withGoogle } from "@/report/google-live";

/**
 * The report itself, for the iframe on /reports/[id]: the design template with the report JSON injected.
 * Admins only (the proxy requires a session; this re-checks admin membership).
 */
export const dynamic = "force-dynamic";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return new NextResponse("Not found", { status: 404 });
  const db = await createClient();
  const { data: user } = await db.auth.getUser();
  if (!user.user) return new NextResponse("Unauthorized", { status: 401 });
  const { data: isAdmin } = await db.rpc("is_admin");
  if (isAdmin !== true) return new NextResponse("Forbidden", { status: 403 });

  const doc = await latestReportDocument(db, id);
  if (!doc) return new NextResponse("This report has no document yet.", { status: 404 });
  return new NextResponse(injectReport(TEMPLATE_HTML, await withLiveGoogle(db, id, doc), "/report-template/"), {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "private, no-store",
      "x-frame-options": "SAMEORIGIN",
      "x-robots-tag": "noindex",
    },
  });
}

/**
 * Pipeline reports of a business with a confirmed Google listing get Google's listing read now, for this response
 * only: it is never stored (Places API policies). Example reports are shown as they are.
 */
async function withLiveGoogle(db: Awaited<ReturnType<typeof createClient>>, reportId: string, doc: NonNullable<Awaited<ReturnType<typeof latestReportDocument>>>) {
  const document = doc.document as Parameters<typeof withGoogle>[0];
  if (doc.source === "fixture" || !document?.credible || !document.webPresence) return doc.document;
  const { data } = await db.from("report").select("business:business_id (place_id)").eq("id", reportId).maybeSingle();
  const placeId = data?.business?.place_id ?? null;
  const key = placesKey();
  if (!placeId || !key) return doc.document;
  const today = new Date().toISOString().slice(0, 10);
  try {
    return withGoogle(document, { details: await placeDetails(placeId, key), error: null }, today);
  } catch (e) {
    return withGoogle(document, { details: null, error: e instanceof PlacesError ? e.message : "Google didn't answer" }, today);
  }
}
