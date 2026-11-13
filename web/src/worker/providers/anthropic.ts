import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { jsonSchemaOutputFormat } from "@anthropic-ai/sdk/helpers/json-schema";
import type { JsonValue, LlmClient, Usage } from "@/engine";
import type { AnswerEngine, AskRequest, AskResult } from "@/engine/answers";
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
  const settings = { tool: "web_search_20260209", fallbacks: "default", max_tokens: 16000 };
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
