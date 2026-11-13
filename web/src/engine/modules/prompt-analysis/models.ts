import type { ModelSpec } from "../../llm";

/**
 * Which model answers for each engine, and which model reads the answers. Changing one: edit here AND add a pricing
 * row for the new model (supabase/migrations), or paid calls fail with "No pricing row". Owner decision 2026-11-13:
 * each provider's current main model with web search on; $5 per-report cap (see docs/build/milestone-2-setup.md).
 */
export const ENGINE_MODELS = [
  { engine: 0, provider: "openai", model: "gpt-6.1-sol", maxSearches: 3 },
  { engine: 1, provider: "anthropic", model: "claude-opus-5-5", maxSearches: 3 },
  { engine: 2, provider: "google", model: "gemini-3.1-pro-preview", maxSearches: 3 },
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
