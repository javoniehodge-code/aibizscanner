import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { jsonSchemaOutputFormat } from "@anthropic-ai/sdk/helpers/json-schema";
import type { JsonValue, LlmClient, Usage } from "@/engine";
import type { AnswerEngine, AskRequest, AskResult, ReadAttempt, ReadRequest, ReadResult } from "@/engine/answers";
import { ENGINE_MODELS } from "@/engine/modules/prompt-analysis/models";
import { trimRaw, unique } from "./raw";

const SPEC = ENGINE_MODELS[1];
/** Server-side refusal fallback: if Claude's safety system declines, the API re-runs the request on another model. */
const FALLBACK_BETA = "server-side-fallback-2026-07-01";
/** A long search turn can pause; we send it back to continue, at most this many times. */
const MAX_CONTINUATIONS = 4;

function addUsage(total: Usage, u: { input_tokens: number; output_tokens: number; cache_read_input_tokens?: number | null; cache_creation_input_tokens?: number | null; server_tool_use?: { web_search_requests: number } | null }) {
  total.tokensIn += u.input_tokens + (u.cache_read_input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0);
  total.tokensOut += u.output_tokens;
  total.searchCalls += u.server_tool_use?.web_search_requests ?? 0;
}

/**
 * Claude engine: Messages API with the web search server tool and the customer's approximate location. Provider
 * defaults otherwise (adaptive thinking at default effort). Refusal fallbacks are on ("default").
 */
export function anthropicEngine(apiKey: string): AnswerEngine {
  const client = new Anthropic({ apiKey, maxRetries: 2 });
  // allowed_callers ["direct"]: Claude runs each search itself and cites the pages in its answer. The tool's default
  // (dynamic filtering) runs searches inside code execution, so answers came back with no citations at all (MVP Miami,
  // 13 Nov 2026: 17 searches, 0 citations). Direct search reads every result, so it uses more tokens.
  const settings = { tool: "web_search_20260209", allowed_callers: ["direct"], fallbacks: "default", max_tokens: 16000 };
  return {
    engine: 1,
    provider: SPEC.provider,
    model: SPEC.model,
    settings,
    estimate: (r) => ({ tokensIn: 60_000, tokensOut: 10_000, searchCalls: r.maxSearches, requests: 1 }),
    async ask(request: AskRequest, signal: AbortSignal): Promise<AskResult> {
      const loc = request.location;
      const messages: Anthropic.Beta.BetaMessageParam[] = [{ role: "user", content: request.question }];
      const usage: Usage = { tokensIn: 0, tokensOut: 0, searchCalls: 0, requests: 0 };
      const responses: Anthropic.Beta.BetaMessage[] = [];
      const texts: string[] = [];
      const citations: string[] = [];
      const queries: string[] = [];
      const sources: string[] = [];
      let final: Anthropic.Beta.BetaMessage | null = null;
      for (let i = 0; i <= MAX_CONTINUATIONS; i++) {
        const msg = await client.beta.messages
          .stream(
            {
              model: SPEC.model,
              max_tokens: 16000,
              betas: [FALLBACK_BETA],
              fallbacks: "default",
              tools: [
                {
                  type: "web_search_20260209",
                  name: "web_search",
                  allowed_callers: ["direct"],
                  max_uses: request.maxSearches,
                  ...(loc ? { user_location: { type: "approximate" as const, city: loc.city, region: loc.region, country: loc.country, timezone: loc.timezone } } : {}),
                },
              ],
              messages,
            },
            { signal },
          )
          .finalMessage();
        responses.push(msg);
        usage.requests += 1;
        addUsage(usage, msg.usage);
        for (const block of msg.content) {
          if (block.type === "text") {
            texts.push(block.text);
            for (const c of block.citations ?? []) if (c.type === "web_search_result_location") citations.push(c.url);
          }
          if (block.type === "web_search_tool_result" && Array.isArray(block.content)) for (const res of block.content) sources.push(res.url);
          if (block.type === "server_tool_use" && block.name === "web_search") {
            const q = (block.input as { query?: unknown } | null)?.query;
            if (typeof q === "string") queries.push(q);
          }
        }
        final = msg;
        if (msg.stop_reason !== "pause_turn") break;
        messages.push({ role: "assistant", content: msg.content as Anthropic.Beta.BetaContentBlockParam[] });
      }
      const text = texts.join("").trim();
      if (final?.stop_reason === "pause_turn") throw new Error(`Claude was still searching after ${MAX_CONTINUATIONS} continuations`);
      return {
        status: final?.stop_reason === "refusal" ? "refused" : "ok",
        text,
        citations: unique(citations),
        searchQueries: unique(queries),
        sources: unique(sources),
        usage,
        raw: trimRaw(responses),
        requestId: (final as { _request_id?: string | null } | null)?._request_id ?? null,
        servedModel: final?.model ?? null,
      };
    },
    estimateRead: () => ({ tokensIn: 40_000, tokensOut: 4_000, searchCalls: 0, requests: 1 }),
    /**
     * Reading test: Anthropic's web fetch tool, called directly (not through code execution) so the fetched content and
     * its retrieval time come back as evidence. Web fetch doesn't run JavaScript (Anthropic's docs).
     */
    async readPage(request: ReadRequest, signal: AbortSignal): Promise<ReadResult> {
      const messages: Anthropic.Beta.BetaMessageParam[] = [{ role: "user", content: request.instruction }];
      const usage: Usage = { tokensIn: 0, tokensOut: 0, searchCalls: 0, requests: 0 };
      const responses: Anthropic.Beta.BetaMessage[] = [];
      const texts: string[] = [];
      const attempts: ReadAttempt[] = [];
      const pending = new Map<string, string>(); // tool_use id -> requested URL
      let final: Anthropic.Beta.BetaMessage | null = null;
      for (let i = 0; i <= MAX_CONTINUATIONS; i++) {
        const msg = await client.beta.messages
          .stream(
            {
              model: SPEC.model,
              max_tokens: 8000,
              betas: [FALLBACK_BETA],
              fallbacks: "default",
              tools: [{ type: "web_fetch_20260209", name: "web_fetch", allowed_callers: ["direct"], max_uses: 2, max_content_tokens: 30_000 }],
              messages,
            },
            { signal },
          )
          .finalMessage();
        responses.push(msg);
        usage.requests += 1;
        addUsage(usage, msg.usage);
        for (const block of msg.content) {
          if (block.type === "text") texts.push(block.text);
          if (block.type === "server_tool_use" && block.name === "web_fetch") {
            const url = (block.input as { url?: unknown } | null)?.url;
            if (typeof url === "string") pending.set(block.id, url);
          }
          if (block.type === "web_fetch_tool_result") {
            const c = block.content;
            if (c.type === "web_fetch_result") {
              const src = c.content.source;
              const data = src.type === "text" ? src.data : null;
              attempts.push({ url: c.url, status: "success", detail: null, retrievedAt: c.retrieved_at ?? null, title: c.content.title ?? null, content: data ? data.slice(0, 50_000) : null });
            } else {
              attempts.push({ url: pending.get(block.tool_use_id) ?? request.url, status: "error", detail: c.error_code, retrievedAt: null, title: null, content: null });
            }
          }
        }
        final = msg;
        if (msg.stop_reason !== "pause_turn") break;
        messages.push({ role: "assistant", content: msg.content as Anthropic.Beta.BetaContentBlockParam[] });
      }
      return {
        status: final?.stop_reason === "refusal" ? "refused" : "ok",
        text: texts.join("").trim(),
        attempts,
        // Anthropic reports when content was retrieved but not whether it came from a cache.
        provenance: "unknown",
        usage,
        raw: trimRaw(responses),
        requestId: (final as { _request_id?: string | null } | null)?._request_id ?? null,
        servedModel: final?.model ?? null,
      };
    },
  };
}

/** Structured extraction calls (ctx.llm) for provider "anthropic". */
export function anthropicLlm(apiKey: string): LlmClient {
  const client = new Anthropic({ apiKey, maxRetries: 2 });
  return {
    async complete(request, signal) {
      const effort = typeof request.settings.effort === "string" ? (request.settings.effort as "low" | "medium" | "high") : undefined;
      const format = request.jsonSchema ? jsonSchemaOutputFormat(request.jsonSchema as { type: "object" }) : null;
      const msg = await client.beta.messages
        .stream(
          {
            model: request.model,
            max_tokens: request.maxOutputTokens,
            system: request.system,
            messages: [{ role: "user", content: request.user }],
            ...(request.temperature === undefined ? {} : { temperature: request.temperature }),
            output_config: {
              ...(effort ? { effort } : {}),
              ...(format ? { format: { type: "json_schema" as const, schema: format.schema } } : {}),
            },
          },
          { signal },
        )
        .finalMessage();
      if (msg.stop_reason === "refusal") throw new Error("The model declined to answer (refusal)");
      if (msg.stop_reason === "max_tokens") throw new Error("The model ran out of output tokens before finishing");
      const usage: Usage = { tokensIn: 0, tokensOut: 0, searchCalls: 0, requests: 1 };
      addUsage(usage, msg.usage);
      return {
        text: msg.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join(""),
        raw: trimRaw(msg) as JsonValue,
        usage,
        requestId: (msg as { _request_id?: string | null })._request_id ?? null,
        servedModel: msg.model,
      };
    },
  };
}
