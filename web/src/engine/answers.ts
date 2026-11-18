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
  /** URLs the provider's search returned (results seen, cited or not), when it reports them. */
  sources: string[];
  usage: Usage;
  /** Provider response with bulky opaque fields removed, kept as evidence. */
  raw: JsonValue;
  requestId: string | null;
  servedModel: string | null;
};

/** One attempt by the provider's own page-reading tool to open a URL, as the provider reports it. */
export type ReadAttempt = {
  url: string;
  /** success / error as the tool reports it; "unknown" when the tool reports no status (OpenAI's open_page). */
  status: "success" | "error" | "unknown";
  detail: string | null;
  /** When the provider says it retrieved the content (Anthropic web fetch), else null. */
  retrievedAt: string | null;
  title: string | null;
  /** Page content the tool returned to the model, when the provider exposes it (Anthropic), capped. */
  content: string | null;
};

export type ReadResult = {
  status: "ok" | "refused";
  /** The model's reply to the reading instruction. */
  text: string;
  /** The tool's attempts to open pages, in order. */
  attempts: ReadAttempt[];
  /** "live" / "cached" only when the provider says so; "unknown" otherwise (never guessed). */
  provenance: "live" | "cached" | "unknown";
  usage: Usage;
  raw: JsonValue;
  requestId: string | null;
  servedModel: string | null;
};

export type ReadRequest = { url: string; instruction: string };

/**
 * A question answered from supplied material only, with no tools (no web search, no page reading): the "website only"
 * test (multi-model-brand-perception.md, Section 2). The material is our copy of the business's pages.
 */
export type OfflineRequest = { instruction: string; material: string };
export type OfflineResult = { status: "ok" | "refused"; text: string; usage: Usage; raw: JsonValue; requestId: string | null; servedModel: string | null };

export interface AnswerEngine {
  readonly engine: EngineIndex;
  readonly provider: string;
  readonly model: string;
  /** What is sent besides the question (recorded with each answer). */
  readonly settings: JsonObject;
  /** Upper-bound usage for one answer, for the spending-cap check before the call. */
  estimate(request: AskRequest): Usage;
  ask(request: AskRequest, signal: AbortSignal): Promise<AskResult>;
  /**
   * Opens one URL with the provider's own page-reading tool (OpenAI web search open_page, Anthropic web fetch, Gemini
   * URL Context). Absent when the provider has no such tool in this configuration. We never fetch the page ourselves
   * and hand it over: that would be our access, not the provider's.
   */
  readPage?(request: ReadRequest, signal: AbortSignal): Promise<ReadResult>;
  /** Upper-bound usage for one page read, for the spending-cap check. */
  estimateRead?(request: ReadRequest): Usage;
  /** Answers from the supplied material only, with every tool off. */
  answerOffline?(request: OfflineRequest, signal: AbortSignal): Promise<OfflineResult>;
  /** Upper-bound usage for one offline answer, for the spending-cap check. */
  estimateOffline?(request: OfflineRequest): Usage;
}

/** Rough token count of a text (about 4 characters a token), for spending-cap estimates. */
export const approxTokens = (s: string) => Math.ceil(s.length / 4);

/** Returns the configured answer engine, or null when its API key is not set. */
export type AnswerEngines = (engine: EngineIndex) => AnswerEngine | null;
