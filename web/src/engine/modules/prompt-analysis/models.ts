import type { ModelSpec } from "../../llm";

/**
 * Which model answers for each engine, and which model reads the answers. Changing one: edit here AND add a pricing
 * row for the new model (supabase/migrations), or paid calls fail with "No pricing row". Owner decision 2026-11-13:
 * each provider's current main model with web search on; $5 per-report cap (see docs/build/milestone-2-setup.md).
 * 2026-11-13: Claude engine moved from claude-opus-5-5 to claude-sonnet-5-5 after the first run (Opus spent $2.26 of $5,
 * mostly reading search results); same web search tool, half the price per token.
 * 2026-11-13: Gemini engine moved from gemini-3.1-pro-preview (404 for the owner's key) to Google's alias
 * gemini-pro-latest, which points at the current Pro model; the model that actually answered is recorded per answer.
 */
export const ENGINE_MODELS = [
  // concurrency: questions in flight at once. OpenAI's per-minute token limits are low on new accounts.
  { engine: 0, provider: "openai", model: "gpt-6.1-sol", maxSearches: 3, concurrency: 3 },
  { engine: 1, provider: "anthropic", model: "claude-sonnet-5-5", maxSearches: 3, concurrency: 6 },
  { engine: 2, provider: "google", model: "gemini-pro-latest", maxSearches: 3, concurrency: 6 },
] as const;

/**
 * Reads one answer and extracts who it names (instruction prompt-analysis/extract-answer). A small, cheap model: the
 * task is reading, not judgment, and every quote it returns is checked against the answer by plain code.
 * Claude Haiku 5.5 doesn't take a temperature; output is schema-constrained (structured outputs).
 */
export const EXTRACTION_MODEL: ModelSpec = {
  provider: "anthropic",
  model: "claude-haiku-5-5",
  capabilities: { temperature: false, structuredOutput: "json_schema", maxOutputTokens: 4000 },
  settings: { effort: "low" },
};
