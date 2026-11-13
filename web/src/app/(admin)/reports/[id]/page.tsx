import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { latestReportDocument } from "@/report/documents";

export const metadata = { title: "Report — AIBizScanner internal" };

export default async function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const db = await createClient();
  const { data: report, error } = await db.from("report").select("id, version, business:business_id (name)").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  if (!report) notFound();
  const doc = await latestReportDocument(db, id);

  return (
    <div>
      <div style={{ display: "flex", gap: 16, alignItems: "baseline", padding: "12px 24px", borderBottom: "1px solid var(--line)" }}>
        <Link href="/reports">← Reports</Link>
        <strong>
          {report.business?.name} v{report.version}
        </strong>
        {doc ? (
          <span className="muted" data-testid="report-source">
            {doc.source === "fixture" ? `Example report (fixture: ${doc.fixture_id})` : "Assembled by the pipeline"} · schema {doc.schema_version} ·{" "}
            {new Date(doc.created_at).toISOString().slice(0, 16).replace("T", " ")} UTC
          </span>
        ) : null}
        <Link href={`/reports/${id}/prompt-analysis`} style={{ marginLeft: "auto" }}>
          Prompt analysis
        </Link>
        <Link href={`/reports/${id}/runs`}>Run monitor</Link>
        {doc ? (
          <a href={`/reports/${id}/document`} target="_blank" rel="noreferrer">
            Open full screen
          </a>
        ) : null}
      </div>
      {doc ? (
        <iframe
          title={`Report: ${report.business?.name ?? ""}`}
          src={`/reports/${id}/document`}
          data-testid="report-frame"
          style={{ display: "block", width: "100%", height: "calc(100vh - 100px)", border: 0 }}
        />
      ) : (
        <main>
          <p className="muted">This report has no report document yet. Run the pipeline stages from the run monitor.</p>
        </main>
      )}
    </div>
  );
}
