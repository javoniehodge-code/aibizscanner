import "server-only";
import { GoogleGenAI } from "@google/genai";
import type { AnswerEngine, AskRequest, AskResult } from "@/engine/answers";
import { ENGINE_MODELS } from "@/engine/modules/prompt-analysis/models";
import { trimRaw, unique } from "./raw";

const SPEC = ENGINE_MODELS[2];
const BLOCKED = new Set(["SAFETY", "RECITATION", "BLOCKLIST", "PROHIBITED_CONTENT", "SPII", "IMAGE_SAFETY"]);
const REDIRECT_HOST = "vertexaisearch.cloud.google.com";

/**
 * Grounding citations come as Google redirect links. Follow one hop (without fetching the page itself) to learn the
 * real URL; if that fails, fall back to the domain Google gives as the title. Unresolved links are kept as they are.
 */
async function resolveCitation(uri: string, title: string | undefined, signal: AbortSignal): Promise<string> {
  let host: string;
  try {
    host = new URL(uri).hostname;
  } catch {
    return uri;
  }
  if (host !== REDIRECT_HOST) return uri;
  try {
    const res = await fetch(uri, { method: "HEAD", redirect: "manual", signal: AbortSignal.any([signal, AbortSignal.timeout(5_000)]) });
    const location = res.headers.get("location");
    if (location && /^https?:\/\//.test(location)) return location;
  } catch {
    // fall through
  }
  return title && /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(title) ? `https://${title}/` : uri;
}

/** Gemini engine: generateContent with Grounding with Google Search. Provider defaults otherwise. */
export function geminiEngine(apiKey: string): AnswerEngine {
  const ai = new GoogleGenAI({ apiKey });
  const settings = { tool: "googleSearch" };
  return {
    engine: 2,
    provider: SPEC.provider,
    model: SPEC.model,
    settings,
    estimate: (r) => ({ tokensIn: 20_000, tokensOut: 10_000, searchCalls: r.maxSearches, requests: 1 }),
    async ask(request: AskRequest, signal: AbortSignal): Promise<AskResult> {
      const res = await ai.models.generateContent({
        model: SPEC.model,
        contents: request.question,
        config: { tools: [{ googleSearch: {} }], abortSignal: signal },
      });
      const candidate = res.candidates?.[0];
      const grounding = candidate?.groundingMetadata;
      const links = (grounding?.groundingChunks ?? []).flatMap((c) => (c.web?.uri ? [{ uri: c.web.uri, title: c.web.title }] : []));
      const citations = await Promise.all(links.map((l) => resolveCitation(l.uri, l.title, signal)));
      const queries = grounding?.webSearchQueries ?? [];
      const u = res.usageMetadata;
      const blocked = !candidate || (candidate.finishReason ? BLOCKED.has(candidate.finishReason) : false) || !!res.promptFeedback?.blockReason;
      const text = res.text ?? "";
      return {
        status: blocked && !text ? "refused" : "ok",
        text,
        citations: unique(citations),
        searchQueries: unique(queries),
        usage: {
          tokensIn: (u?.promptTokenCount ?? 0) + (u?.toolUsePromptTokenCount ?? 0),
          tokensOut: (u?.candidatesTokenCount ?? 0) + (u?.thoughtsTokenCount ?? 0),
          // Gemini 3 models bill grounding per search query the model runs.
          searchCalls: queries.length,
          requests: 1,
        },
        raw: trimRaw(res),
        requestId: res.responseId ?? null,
        servedModel: res.modelVersion ?? null,
      };
    },
  };
}
