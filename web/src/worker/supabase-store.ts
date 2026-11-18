import "server-only";
import type { Json, Tables } from "@/lib/database.types";
import type { ServiceClient } from "@/lib/supabase/service";
import type { AnswerEvidence, ClaimedRun, InstructionRef, JsonObject, JsonValue, Pricing, RunStore, SourceClassificationRecord, StageInput } from "@/engine";

function check<T>(res: { data: T; error: { message: string } | null }, what: string): T {
  if (res.error) throw new Error(`${what}: ${res.error.message}`);
  return res.data;
}

function required<T>(res: { data: T; error: { message: string } | null }, what: string): NonNullable<T> {
  const data = check(res, what);
  if (data === null || data === undefined) throw new Error(`${what}: no data returned`);
  return data;
}

export function toClaimedRun(row: Tables<"stage_run">): ClaimedRun {
  return {
    id: row.id,
    reportId: row.report_id,
    stage: row.stage,
    version: row.version,
    attempt: row.attempt,
    maxAttempts: row.max_attempts,
    timeoutMs: row.timeout_ms,
    params: (row.params ?? {}) as JsonObject,
    inputRunIds: row.input_run_ids,
    instructions: (row.instruction_refs ?? []) as InstructionRef[],
  };
}

/** RunStore backed by Supabase, using the service-role client (the worker is not a signed-in user). */
export function supabaseRunStore(db: ServiceClient): RunStore {
  return {
    async loadInputs(runIds) {
      if (runIds.length === 0) return [];
      const rows = required(
        await db.from("stage_run").select("id, stage, output, output_hash, status, finished_at").in("id", [...runIds]),
        "load inputs",
      );
      return rows.map(
        (r): StageInput => ({ runId: r.id, stage: r.stage, output: r.output as JsonValue, outputHash: r.output_hash, finishedAt: r.finished_at }),
      );
    },
    async latestPricing(provider, model): Promise<Pricing | null> {
      const row = check(
        await db
          .from("pricing")
          .select("*")
          .eq("provider", provider)
          .eq("model", model)
          .lte("effective_from", new Date().toISOString())
          .order("version", { ascending: false })
          .limit(1)
          .maybeSingle(),
        "load pricing",
      );
      if (!row) return null;
      return {
        id: row.id,
        provider: row.provider,
        model: row.model,
        version: row.version,
        inputUsdPerMtok: Number(row.input_usd_per_mtok),
        outputUsdPerMtok: Number(row.output_usd_per_mtok),
        searchUsdPerCall: Number(row.search_usd_per_call),
        requestUsdPerCall: Number(row.request_usd_per_call),
      };
    },
    async reportSpendUsd(reportId) {
      return Number(check(await db.rpc("report_spend_usd", { p_report_id: reportId }), "report spend"));
    },
    async reportSpendingCapUsd(reportId) {
      const row = required(
        await db.from("report").select("spending_cap_usd").eq("id", reportId).single(),
        "report spending cap",
      );
      return Number(row.spending_cap_usd);
    },
    async recordEngineAnswer(r) {
      const row = required(
        await db
          .from("engine_answer")
          .insert({
            report_id: r.reportId,
            stage_run_id: r.stageRunId,
            prompt_set_id: r.promptSetId,
            prompt_id: r.promptId,
            prompt_text: r.promptText,
            engine: r.engine,
            model: r.model,
            request_id: r.requestId,
            settings: r.settings as { [key: string]: Json },
            raw_response: r.rawResponse as Json,
            answer_text: r.answerText,
            citations: r.citations as unknown as Json[],
            status: r.status,
            error: r.error,
            requested_at: r.requestedAt,
            responded_at: r.respondedAt,
          })
          .select("id")
          .single(),
        "record engine answer",
      );
      return row.id;
    },
    async loadEngineAnswers(stageRunId) {
      const rows = required(
        await db.from("engine_answer").select("id, report_id, stage_run_id, prompt_set_id, prompt_id, prompt_text, engine, model, request_id, settings, answer_text, citations, status, error, requested_at, responded_at").eq("stage_run_id", stageRunId).order("created_at", { ascending: true }),
        "load engine answers",
      );
      return rows.map((r) => ({
        id: r.id,
        reportId: r.report_id,
        stageRunId: r.stage_run_id ?? stageRunId,
        promptSetId: r.prompt_set_id,
        promptId: r.prompt_id,
        promptText: r.prompt_text,
        engine: r.engine as "chatgpt" | "claude" | "gemini",
        model: r.model,
        requestId: r.request_id,
        settings: (r.settings ?? {}) as JsonObject,
        rawResponse: null, // not needed to resume; stays in the table
        answerText: r.answer_text,
        citations: (Array.isArray(r.citations) ? r.citations : []) as { url: string }[],
        status: r.status as "ok" | "error" | "refused" | "unavailable",
        error: r.error,
        requestedAt: r.requested_at,
        respondedAt: r.responded_at,
      }));
    },
    async loadAnswerEvidence(answerIds) {
      const out: AnswerEvidence[] = [];
      // Raw responses run to tens of KB each; fetch in small pages.
      for (let i = 0; i < answerIds.length; i += 10) {
        const ids = answerIds.slice(i, i + 10);
        const rows = required(await db.from("engine_answer").select("id, raw_response, answer_text").in("id", ids), "load answer evidence");
        for (const r of rows) out.push({ answerId: r.id, rawResponse: (r.raw_response ?? null) as JsonValue, answerText: r.answer_text });
      }
      return out;
    },
    async recordPageSnapshot(r) {
      const row = required(
        await db
          .from("page_snapshot")
          .insert({
            report_id: r.reportId,
            stage_run_id: r.stageRunId,
            url: r.url,
            final_url: r.finalUrl,
            fetch_mode: r.fetchMode,
            engine: r.engine ?? null,
            user_agent: r.userAgent,
            http_status: r.httpStatus,
            content_hash: r.contentHash,
            text_hash: r.textHash,
            error: r.error,
            fetched_at: r.fetchedAt,
          })
          .select("id")
          .single(),
        "record page snapshot",
      );
      if (r.html !== null || r.text !== null) {
        check(await db.from("page_snapshot_body").insert({ snapshot_id: row.id, html: r.html, text: r.text }), "record page snapshot body");
      }
      return row.id;
    },
    async loadLatestGoodSnapshots(reportId, urls) {
      const out = new Map<string, { snapshotId: string; text: string; fetchedAt: string }>();
      if (!urls.length) return out;
      const rows = required(
        await db
          .from("page_snapshot")
          .select("id, url, fetched_at, page_snapshot_body (text)")
          .eq("report_id", reportId)
          .eq("fetch_mode", "raw")
          .gte("http_status", 200)
          .lt("http_status", 300)
          .in("url", [...urls])
          .order("fetched_at", { ascending: false }),
        "load latest good snapshots",
      );
      for (const r of rows) {
        const text = (Array.isArray(r.page_snapshot_body) ? r.page_snapshot_body[0]?.text : (r.page_snapshot_body as { text: string | null } | null)?.text) ?? null;
        if (text && !out.has(r.url)) out.set(r.url, { snapshotId: r.id, text, fetchedAt: r.fetched_at });
      }
      return out;
    },
    async loadFullestRenderedSnapshots(reportId, urls) {
      const out = new Map<string, { snapshotId: string; text: string; fetchedAt: string; words: number }>();
      if (!urls.length) return out;
      const rows = required(
        await db
          .from("page_snapshot")
          .select("id, url, fetched_at, page_snapshot_body (text)")
          .eq("report_id", reportId)
          .eq("fetch_mode", "rendered")
          .gte("http_status", 200)
          .lt("http_status", 300)
          .in("url", [...urls])
          .order("fetched_at", { ascending: false })
          .limit(200),
        "load fullest rendered snapshots",
      );
      for (const r of rows) {
        const text = (Array.isArray(r.page_snapshot_body) ? r.page_snapshot_body[0]?.text : (r.page_snapshot_body as { text: string | null } | null)?.text) ?? null;
        if (!text) continue;
        const words = text.split(/\s+/).filter(Boolean).length;
        const prev = out.get(r.url);
        if (!prev || words > prev.words) out.set(r.url, { snapshotId: r.id, text, fetchedAt: r.fetched_at, words });
      }
      return out;
    },
    async loadSnapshotHtml(ids) {
      const out = new Map<string, string>();
      if (!ids.length) return out;
      const rows = required(await db.from("page_snapshot_body").select("snapshot_id, html").in("snapshot_id", [...ids]), "load snapshot html");
      for (const r of rows) if (r.html !== null) out.set(r.snapshot_id, r.html);
      return out;
    },
    async loadSnapshotTexts(ids) {
      const out = new Map<string, string>();
      if (!ids.length) return out;
      const rows = required(await db.from("page_snapshot_body").select("snapshot_id, text").in("snapshot_id", [...ids]), "load snapshot texts");
      for (const r of rows) if (r.text !== null) out.set(r.snapshot_id, r.text);
      return out;
    },
    async loadSourceClassifications(pageKeys, classifierVersion) {
      const out: SourceClassificationRecord[] = [];
      for (let i = 0; i < pageKeys.length; i += 100) {
        const rows = required(
          await db
            .from("source_classification")
            .select("page_key, classifier_version, source_group, unclassified, reason, evidence, model, stage_run_id")
            .eq("classifier_version", classifierVersion)
            .in("page_key", pageKeys.slice(i, i + 100)),
          "load source classifications",
        );
        for (const r of rows) {
          out.push({
            pageKey: r.page_key,
            classifierVersion: r.classifier_version,
            group: r.source_group,
            unclassified: r.unclassified as "outside" | "insufficient" | null,
            reason: r.reason,
            evidence: r.evidence,
            model: r.model,
            stageRunId: r.stage_run_id,
          });
        }
      }
      return out;
    },
    async recordSourceClassification(r) {
      check(
        await db.from("source_classification").upsert(
          {
            page_key: r.pageKey,
            classifier_version: r.classifierVersion,
            source_group: r.group,
            unclassified: r.unclassified,
            reason: r.reason,
            evidence: r.evidence,
            model: r.model,
            stage_run_id: r.stageRunId,
          },
          { onConflict: "page_key,classifier_version", ignoreDuplicates: true },
        ),
        "record source classification",
      );
    },
    async recordUsage(r) {
      check(
        await db.from("usage_event").insert({
          stage_run_id: r.stageRunId,
          attempt: r.attempt,
          provider: r.provider,
          model: r.model,
          pricing_id: r.pricingId,
          tokens_in: r.usage.tokensIn,
          tokens_out: r.usage.tokensOut,
          search_calls: r.usage.searchCalls,
          requests: r.usage.requests,
          cost_usd: r.costUsd,
          duration_ms: r.durationMs,
          succeeded: r.succeeded,
          error: r.error,
        }),
        "record usage",
      );
    },
    async recordInstruction(i) {
      check(await db.rpc("record_llm_instruction", { p_id: i.id, p_version: i.version, p_sha256: i.sha256, p_body: i.text }), "record instruction");
    },
    async recordLlmCall(r) {
      check(
        await db.from("llm_call").insert({
          stage_run_id: r.stageRunId,
          attempt: r.attempt,
          instruction_id: r.instruction.id,
          instruction_version: r.instruction.version,
          provider: r.provider,
          model: r.model,
          served_model: r.servedModel,
          request_id: r.requestId,
          settings: r.settings as { [key: string]: Json },
          input: r.input as Json,
          raw_response: r.rawResponse as Json,
          output: r.output as Json,
          valid: r.valid,
          error: r.error,
          duration_ms: r.durationMs,
        }),
        "record LLM call",
      );
    },
    async retry(runId, attempt, error, runAfter) {
      return required(
        await db.rpc("retry_stage_run", {
          p_id: runId,
          p_attempt: attempt,
          p_error: error,
          p_run_after: runAfter.toISOString(),
        }),
        "retry run",
      );
    },
    async finish(runId, attempt, status, output, outputHash, error) {
      return required(
        await db.rpc("finish_stage_run", {
          p_id: runId,
          p_attempt: attempt,
          p_status: status,
          // Nullable in SQL; the generated types do not express nullable function arguments.
          p_output: output as Json,
          p_output_hash: outputHash as string,
          p_error: error as string,
        }),
        "finish run",
      );
    },
  };
}
