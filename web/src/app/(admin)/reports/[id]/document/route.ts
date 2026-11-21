import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { latestReportDocument } from "@/report/documents";
import { TEMPLATE_HTML } from "@/report/generated/template";
import { injectReport } from "@/report/inject";
import { PlacesError, placeDetails, placesKey, searchPlaces, type PlaceDetails } from "@/lib/google/places";
import { matchListing, withCompetitorRatings, withGoogle, type CompetitorListing } from "@/report/google-live";

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
  const { data } = await db.from("report").select("competitor_place_ids, business:business_id (place_id, location)").eq("id", reportId).maybeSingle();
  const placeId = data?.business?.place_id ?? null;
  const key = placesKey();
  if (!placeId || !key) return doc.document;
  const today = new Date().toISOString().slice(0, 10);
  let target: PlaceDetails | null = null;
  let out: Parameters<typeof withGoogle>[0];
  try {
    target = await placeDetails(placeId, key);
    out = withGoogle(document, { details: target, error: null }, today);
  } catch (e) {
    out = withGoogle(document, { details: null, error: e instanceof PlacesError ? e.message : "Google didn't answer" }, today);
  }
  return withLiveCompetitors(db, reportId, out, target, (data?.competitor_place_ids ?? {}) as Record<string, { id: string | null; at: string }>, data?.business?.location ?? "", key, today);
}

/**
 * Part 5b: each compared business's Google rating, read now and never stored. A competitor's listing is found once
 * with Text Search ("name, location"; only a result named like it counts) and only its place ID is kept on the report.
 */
async function withLiveCompetitors(
  db: Awaited<ReturnType<typeof createClient>>,
  reportId: string,
  document: Parameters<typeof withGoogle>[0],
  target: PlaceDetails | null,
  stored: Record<string, { id: string | null; at: string }>,
  location: string,
  key: string,
  today: string,
) {
  const comp = (document as { competitors?: { compared?: { v: [string, string] } } | null }).competitors;
  const keys = comp?.compared?.v;
  if (!keys) return document;
  const names = (document as unknown as { promptAnalysis: { businesses: { v: { key: string; name: string } }[] } }).promptAnalysis.businesses;
  const nameOf = (k: string) => names.find((b) => b.v.key === k)?.v.name ?? k;
  const ids = { ...stored };
  let changed = false;
  const listing = async (name: string): Promise<CompetitorListing> => {
    const k = name.toLowerCase();
    try {
      if (!(k in ids)) {
        const found = matchListing(name, await searchPlaces(`${name}, ${location}`, key));
        ids[k] = { id: found?.id ?? null, at: today };
        changed = true;
      }
      const id = ids[k]!.id;
      return id ? { details: await placeDetails(id, key) } : { none: true };
    } catch (e) {
      return { error: e instanceof PlacesError ? e.message : "Google didn't answer" };
    }
  };
  const [a, b] = await Promise.all(keys.map((k) => listing(nameOf(k))));
  if (changed) await db.from("report").update({ competitor_place_ids: ids }).eq("id", reportId);
  const own: CompetitorListing = target ? { details: target } : { error: "Couldn't load your Google listing" };
  return withCompetitorRatings(document, [own, a!, b!]);
}
