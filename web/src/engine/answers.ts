import type { JsonObject, JsonValue, Usage } from "./types";

/**
 * Answer engines: ask a consumer AI product's model (ChatGPT / Claude / Gemini) one customer question, with web search
 * on, the way a customer would. Unlike ctx.llm there is no instruction and no output schema: the free-text answer and
 * its citations ARE the evidence. Provider adapters live in the worker layer (worker/providers); the engine never sees
 * keys.
 */

/** 0 ChatGPT (OpenAI), 1 Claude (Anthropic), 2 Gemini (Google): the report's engine order. */
export type EngineIndex = 0 | 1 | 2;

export const ENGINE_NAMES = ["ChatGPT", "Claude", "Gemini"] as const;

export type AskLocation = { city: string; region: string; country: string; timezone: string };

export type AskRequest = {
  question: string;
  /** Approximate customer location, passed to providers that accept one. */
  location: AskLocation | null;
  /** Upper bound on web searches for this answer (where the provider lets us cap it). */
  maxSearches: number;
};

export type AskResult = {
  /** "refused": the provider's safety system declined. Text may be empty. */
  status: "ok" | "refused";
  text: string;
  /** Cited URLs in order of first citation (deduplicated). */
  citations: string[];
  /** Search queries the provider reports having run. */
  searchQueries: string[];
  usage: Usage;
  /** Provider response with bulky opaque fields removed, kept as evidence. */
  raw: JsonValue;
  requestId: string | null;
  servedModel: string | null;
};

export interface AnswerEngine {
  readonly engine: EngineIndex;
  readonly provider: string;
  readonly model: string;
  /** What is sent besides the question (recorded with each answer). */
  readonly settings: JsonObject;
  /** Upper-bound usage for one answer, for the spending-cap check before the call. */
  estimate(request: AskRequest): Usage;
  ask(request: AskRequest, signal: AbortSignal): Promise<AskResult>;
}

/** Returns the configured answer engine, or null when its API key is not set. */
export type AnswerEngines = (engine: EngineIndex) => AnswerEngine | null;
