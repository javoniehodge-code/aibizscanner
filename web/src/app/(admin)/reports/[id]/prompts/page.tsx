import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { examplePromptSet, formatGroups, formatPrompts, storedPromptSet, type PromptSetDraft } from "@/lib/prompt-sets";
import { createClient } from "@/lib/supabase/server";
import { formatUsd } from "@/lib/format";
import { PromptSetForm } from "./prompt-set-form";

export const metadata = { title: "Prompt set — AIBizScanner internal" };

const PA_STAGES = ["pa_prompt_set", "pa_answers_chatgpt", "pa_answers_claude", "pa_answers_gemini", "pa_extract", "pa_assemble"];

export default async function PromptSetPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const db = await createClient();
  const [reportRes, setRes, busyRes] = await Promise.all([
    db.from("report").select("id, version, spending_cap_usd, business:business_id (name, location)").eq("id", id).maybeSingle(),
    db.from("prompt_set").select("id, version, groups, prompts, customer_location, approved_at").eq("report_id", id).order("version", { ascending: false }).limit(1).maybeSingle(),
    db.from("stage_run").select("id", { count: "exact", head: true }).eq("report_id", id).in("stage", PA_STAGES).in("status", ["queued", "running"]),
  ]);
  for (const r of [reportRes, setRes, busyRes]) if (r.error) throw new Error(r.error.message);
  const report = reportRes.data;
  if (!report) notFound();

  const stored = setRes.data ? storedPromptSet.safeParse(setRes.data) : null;
  const draft: PromptSetDraft = stored?.success
    ? { groups: stored.data.groups, prompts: stored.data.prompts, location: stored.data.customer_location }
    : examplePromptSet();
  const loc = draft.location ?? { city: "", region: "", country: "", timezone: "" };

  return (
    <main style={{ maxWidth: 1100 }}>
      <p>
        <Link href={`/reports/${id}/prompt-analysis`}>← Prompt analysis</Link> · <Link href={`/reports/${id}/runs`}>Run monitor</Link>
      </p>
      <h1>
        Prompt set — {report.business?.name} v{report.version}
      </h1>
      <p>
        {setRes.data ? (
          <>
            Showing approved version {setRes.data.version}
            {setRes.data.approved_at ? ` (${setRes.data.approved_at.slice(0, 10)})` : ""}. Approving again saves a new version; earlier versions stay
            unchanged.
          </>
        ) : (
          <>
            No prompt set yet. The form starts from the 12 questions of the MVP Miami example report — edit them for {report.business?.name}.
          </>
        )}
      </p>
      <p className="muted">
        Each question is asked once to ChatGPT, Claude and Gemini through their APIs with web search on (up to 3 searches each), then a small model
        reads every answer. Rough cost: about $0.20 per question for all three engines, so 12 questions ≈ $2.50. Paid calls stop at the spending cap
        (currently {formatUsd(report.spending_cap_usd)}); anything not asked is shown as unavailable.
      </p>
      <PromptSetForm
        reportId={id}
        groups={formatGroups(draft.groups)}
        prompts={formatPrompts(draft.prompts)}
        location={loc}
        cap={Number(report.spending_cap_usd)}
        busy={(busyRes.count ?? 0) > 0}
      />
    </main>
  );
}
