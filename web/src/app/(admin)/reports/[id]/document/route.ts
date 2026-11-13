import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { latestReportDocument } from "@/report/documents";
import { TEMPLATE_HTML } from "@/report/generated/template";
import { injectReport } from "@/report/inject";

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
  return new NextResponse(injectReport(TEMPLATE_HTML, doc.document, "/report-template/"), {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "private, no-store",
      "x-frame-options": "SAMEORIGIN",
      "x-robots-tag": "noindex",
    },
  });
}
