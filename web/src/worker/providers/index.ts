import "server-only";
import type { Providers } from "@/engine";
import type { AnswerEngine, EngineIndex } from "@/engine/answers";
import type { LlmClient } from "@/engine";
import { providerKeys } from "@/lib/server-env";
import { anthropicEngine, anthropicLlm } from "./anthropic";
import { geminiEngine } from "./gemini";
import { openAiEngine } from "./openai";

/**
 * Paid-API clients for the worker, built from whichever keys are set (OPENAI_API_KEY, ANTHROPIC_API_KEY,
 * GEMINI_API_KEY). A missing key leaves that engine unconfigured: its answers are reported as unavailable.
 */
export function workerProviders(): Providers {
  const keys = providerKeys();
  const engines: Record<EngineIndex, AnswerEngine | null> = {
    0: keys.openai ? openAiEngine(keys.openai) : null,
    1: keys.anthropic ? anthropicEngine(keys.anthropic) : null,
    2: keys.gemini ? geminiEngine(keys.gemini) : null,
  };
  const llmByProvider: Record<string, LlmClient | null> = { anthropic: keys.anthropic ? anthropicLlm(keys.anthropic) : null };
  const llm: LlmClient = {
    complete(request, signal) {
      const client = llmByProvider[request.provider];
      if (!client) throw new Error(`No API key configured for ${request.provider} (needed for model ${request.model})`);
      return client.complete(request, signal);
    },
  };
  return { llm, answers: (engine) => engines[engine] };
}
