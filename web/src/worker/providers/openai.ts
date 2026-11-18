import "server-only";
import OpenAI from "openai";
import { approxTokens, type AnswerEngine, type AskRequest, type AskResult, type OfflineRequest, type OfflineResult, type ReadAttempt, type ReadRequest, type ReadResult } from "@/engine/answers";
import { ENGINE_MODELS } from "@/engine/modules/prompt-analysis/models";
import { trimRaw, unique } from "./raw";

const SPEC = ENGINE_MODELS[0];

/**
 * ChatGPT engine: OpenAI Responses API with the hosted web_search tool and the customer's approximate location.
 * Provider defaults otherwise (no temperature, default reasoning), to stay close to what a customer would get.
 */
export function openAiEngine(apiKey: string): AnswerEngine {
  const client = new OpenAI({ apiKey, maxRetries: 2 });
  const settings = { tool: "web_search", search_context_size: "medium", store: false };
  return {
    engine: 0,
    provider: SPEC.provider,
    model: SPEC.model,
    settings,
    estimate: (r) => ({ tokensIn: 40_000, tokensOut: 8_000, searchCalls: r.maxSearches, requests: 1 }),
    async ask(request: AskRequest, signal: AbortSignal): Promise<AskResult> {
      const loc = request.location;
      const res = await client.responses.create(
        {
          model: SPEC.model,
          input: request.question,
          tools: [
            {
              type: "web_search",
              search_context_size: "medium",
              ...(loc ? { user_location: { type: "approximate" as const, city: loc.city, region: loc.region, country: loc.country, timezone: loc.timezone } } : {}),
            },
          ],
          max_tool_calls: request.maxSearches,
          include: ["web_search_call.action.sources"],
          store: false,
        },
        { signal },
      );
      const citations: string[] = [];
      const queries: string[] = [];
      const sources: string[] = [];
      let refused = false;
      let searches = 0;
      for (const item of res.output) {
        if (item.type === "web_search_call") {
          searches += 1;
          if (item.action?.type === "search") {
            queries.push(...(item.action.queries ?? (item.action.query ? [item.action.query] : [])));
            for (const src of item.action.sources ?? []) if (src.type === "url") sources.push(src.url);
          }
        }
        if (item.type === "message") {
          for (const c of item.content) {
            if (c.type === "refusal") refused = true;
            if (c.type === "output_text") for (const a of c.annotations) if (a.type === "url_citation") citations.push(a.url);
          }
        }
      }
      const text = res.output_text ?? "";
      return {
        status: refused && !text ? "refused" : "ok",
        text,
        citations: unique(citations),
        searchQueries: unique(queries),
        sources: unique(sources),
        usage: {
          tokensIn: res.usage?.input_tokens ?? 0,
          tokensOut: res.usage?.output_tokens ?? 0,
          searchCalls: res.tool_usage?.web_search?.num_requests ?? searches,
          requests: 1,
        },
        raw: trimRaw(res),
        requestId: res._request_id ?? null,
        servedModel: res.model ?? null,
      };
    },
    estimateOffline: (r) => ({ tokensIn: approxTokens(r.instruction + r.material) + 500, tokensOut: 6_000, searchCalls: 0, requests: 1 }),
    /** Website-only answer: Responses API with no tools. */
    async answerOffline(request: OfflineRequest, signal: AbortSignal): Promise<OfflineResult> {
      const res = await client.responses.create({ model: SPEC.model, instructions: request.instruction, input: request.material, store: false }, { signal });
      const refused = res.output.some((item) => item.type === "message" && item.content.some((c) => c.type === "refusal"));
      const text = res.output_text ?? "";
      return {
        status: refused && !text ? "refused" : "ok",
        text,
        usage: { tokensIn: res.usage?.input_tokens ?? 0, tokensOut: res.usage?.output_tokens ?? 0, searchCalls: 0, requests: 1 },
        raw: trimRaw(res),
        requestId: res._request_id ?? null,
        servedModel: res.model ?? null,
      };
    },
    estimateRead: () => ({ tokensIn: 30_000, tokensOut: 4_000, searchCalls: 2, requests: 1 }),
    /**
     * Reading test: the same web_search tool, asked to open the URL. Evidence is an open_page action on that URL
     * (reasoning models only); the tool reports no success status, so attempts are "unknown" and the passages the
     * model returns are checked against our snapshot in plain code.
     */
    async readPage(request: ReadRequest, signal: AbortSignal): Promise<ReadResult> {
      const res = await client.responses.create(
        {
          model: SPEC.model,
          input: request.instruction,
          tools: [{ type: "web_search", search_context_size: "medium" }],
          max_tool_calls: 3,
          include: ["web_search_call.action.sources"],
          store: false,
        },
        { signal },
      );
      const attempts: ReadAttempt[] = [];
      let refused = false;
      let searches = 0;
      for (const item of res.output) {
        if (item.type === "web_search_call") {
          if (item.action?.type === "search") searches += 1;
          if (item.action?.type === "open_page" && item.action.url) {
            attempts.push({ url: item.action.url, status: "unknown", detail: item.status ?? null, retrievedAt: null, title: null, content: null });
          }
        }
        if (item.type === "message") for (const c of item.content) if (c.type === "refusal") refused = true;
      }
      const text = res.output_text ?? "";
      return {
        status: refused && !text ? "refused" : "ok",
        text,
        attempts,
        provenance: "unknown",
        usage: { tokensIn: res.usage?.input_tokens ?? 0, tokensOut: res.usage?.output_tokens ?? 0, searchCalls: res.tool_usage?.web_search?.num_requests ?? searches, requests: 1 },
        raw: trimRaw(res),
        requestId: res._request_id ?? null,
        servedModel: res.model ?? null,
      };
    },
  };
}
