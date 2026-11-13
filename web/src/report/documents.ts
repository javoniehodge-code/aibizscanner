import "server-only";
import type { Json } from "@/lib/database.types";
import type { createClient } from "@/lib/supabase/server";
import { FIXTURES } from "./generated/fixtures";
import { reportDocument, SCHEMA_VERSION } from "./schema";

type Db = Awaited<ReturnType<typeof createClient>>;

/** Example reports loadable from the reports screen. Category is not part of the report document, so it lives here. */
export const EXAMPLE_REPORTS = [
  { fixtureId: "brownstone", category: "Moving company" },
  { fixtureId: "mvp-miami", category: "Exotic car, mansion and yacht rentals" },
] as const;

/** Validates each fixture against the report schema and loads it (business + report + document). Idempotent. */
export async function loadExampleReports(db: Db): Promise<string[]> {
  const ids: string[] = [];
  for (const { fixtureId, category } of EXAMPLE_REPORTS) {
    const raw = FIXTURES[fixtureId];
    const parsed = reportDocument.safeParse(raw);
    if (!parsed.success) throw new Error(`Fixture ${fixtureId} does not match the report schema: ${parsed.error.issues[0]?.message}`);
    const biz = parsed.data.business.v;
    const { data, error } = await db.rpc("load_fixture_report", {
      p_fixture_id: fixtureId,
      p_schema_version: SCHEMA_VERSION,
      p_document: raw as Json,
      p_name: biz.name,
      p_category: category,
      p_location: biz.location,
      p_website: `https://${biz.domain}/`,
      p_domains: [biz.domain],
    });
    if (error) throw new Error(`Loading ${fixtureId}: ${error.message}`);
    ids.push(data);
  }
  return ids;
}

/** Latest report document for a report, or null. */
export async function latestReportDocument(db: Db, reportId: string) {
  const { data, error } = await db
    .from("report_document")
    .select("id, document, source, fixture_id, schema_version, created_at")
    .eq("report_id", reportId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}
