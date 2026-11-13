import "server-only";
import type { Json, Tables } from "@/lib/database.types";
import type { ServiceClient } from "@/lib/supabase/service";
import type { ClaimedRun, InstructionRef, JsonObject, JsonValue, Pricing, RunStore, StageInput } from "@/engine";

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
        await db.from("stage_run").select("id, stage, output, output_hash, status").in("id", [...runIds]),
        "load inputs",
      );
      return rows.map(
        (r): StageInput => ({ runId: r.id, stage: r.stage, output: r.output as JsonValue, outputHash: r.output_hash }),
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
