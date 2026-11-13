import type { EngineModule } from "../types";
import { PROMPT_ANALYSIS_STAGES } from "./stages";

/**
 * Prompt analysis (AI Recommendation section): the approved questions are asked to ChatGPT, Claude and Gemini with web
 * search on; a small model reads each answer; plain code checks every quote and does all counting.
 */
export const promptAnalysisModule: EngineModule = {
  id: "prompt-analysis",
  label: "Prompt analysis",
  stages: PROMPT_ANALYSIS_STAGES,
};
