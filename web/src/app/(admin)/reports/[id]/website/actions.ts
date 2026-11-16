"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { classifiedSources } from "@/engine/modules/prompt-analysis/schemas";
import { pageKind } from "@/engine/modules/website/logic/pages";
import { requireAdmin } from "@/lib/auth";
import { EnqueueError, enqueueStage } from "@/lib/stage-runs";
import { DEFAULT_PAGE_CAP, MAX_PAGES } from "@/lib/website-pages";
import { createClient } from "@/lib/supabase/server";

export type WebsiteFormState = { errors: string[]; message?: string };


/**
 * Queues ws_discover for the report's business: its website, domains and services, plus the own-site pages the AI
 * engines cited in the latest prompt analysis (suggested first).
 */
export async function findPages(_prev: WebsiteFormState, form: FormData): Promise<WebsiteFormState> {
  await requireAdmin();
  const reportId = z.uuid().parse(form.get("reportId"));
  const db = await createClient();
  const { data: report, error } = await db.from("report").select("id, business:business_id (website, domains, services, location)").eq("id", reportId).single();
  if (error) throw new Error(error.message);
  const biz = report.business;
  if (!biz?.website) return { errors: ["The business has no website. Add it on the business page first."] };

  const { data: src } = await db
    .from("stage_run")
    .select("output")
    .eq("report_id", reportId)
    .eq("stage", "pa_sources")
    .in("status", ["done", "partial"])
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  const sources = src ? classifiedSources.safeParse(src.output) : null;
  const cited = sources?.success ? sources.data.pages.filter((p) => p.owner === "target").map((p) => p.url) : [];

  try {
    await enqueueStage(db, reportId, "ws_discover", {
      website: biz.website,
      domains: biz.domains,
      services: biz.services,
      locations: [],
      cited,
      cap: DEFAULT_PAGE_CAP,
    });
  } catch (e) {
    if (e instanceof EnqueueError) return { errors: [e.message] };
    throw e;
  }
  revalidatePath(`/reports/${reportId}`, "layout");
  return { errors: [], message: "Finding pages. This page shows them when the worker has run (usually within a minute)." };
}

const pageEntry = z.object({ url: z.string().url(), reason: z.string().min(1).max(200) });

/** Saves the checked pages (plus any added URLs) as a new approved page set, and queues the snapshots. */
export async function approvePages(_prev: WebsiteFormState, form: FormData): Promise<WebsiteFormState> {
  const admin = await requireAdmin();
  const reportId = z.uuid().parse(form.get("reportId"));
  const website = z.string().url().parse(form.get("website"));
  const errors: string[] = [];
  const pages: { url: string; kind: string; reason: string }[] = [];
  const seen = new Set<string>();
  const push = (url: string, reason: string) => {
    const parsed = pageEntry.safeParse({ url, reason });
    if (!parsed.success) return errors.push(`Not a valid page address: ${url}`);
    const key = url.replace(/#.*$/, "").replace(/\/+$/, "");
    if (seen.has(key)) return;
    seen.add(key);
    pages.push({ url: parsed.data.url, kind: pageKind(parsed.data.url), reason: parsed.data.reason });
  };
  for (const v of form.getAll("page")) {
    if (typeof v !== "string") continue;
    const [url = "", ...reason] = v.split("\t");
    push(url, reason.join("\t") || "Selected by admin");
  }
  const added = typeof form.get("added") === "string" ? (form.get("added") as string) : "";
  for (const line of added.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)) push(line, "Added by admin");
  if (!pages.length) errors.push("Choose at least one page.");
  if (pages.length > MAX_PAGES) errors.push(`At most ${MAX_PAGES} pages per report (${pages.length} chosen).`);
  if (errors.length) return { errors };

  const db = await createClient();
  const { data: last, error: lastError } = await db.from("website_page_set").select("version").eq("report_id", reportId).order("version", { ascending: false }).limit(1).maybeSingle();
  if (lastError) throw new Error(lastError.message);
  const approvedAt = new Date().toISOString();
  const { data: set, error } = await db
    .from("website_page_set")
    .insert({ report_id: reportId, version: (last?.version ?? 0) + 1, pages, approved_by: admin.userId, approved_at: approvedAt })
    .select("id, version")
    .single();
  if (error) throw new Error(error.message);
  try {
    await enqueueStage(db, reportId, "ws_page_set", { pageSet: { id: set.id, version: set.version, approvedAt }, website, pages });
  } catch (e) {
    if (e instanceof EnqueueError) return { errors: [`Page set v${set.version} was saved, but the snapshots could not start: ${e.message}`] };
    throw e;
  }
  revalidatePath(`/reports/${reportId}`, "layout");
  return { errors: [], message: `Page set v${set.version} approved (${pages.length} pages). Snapshots run next.` };
}
