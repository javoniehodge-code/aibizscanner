import type { EngineModule } from "../types";
import { CONTENT_STAGES } from "./stages";

/**
 * Website content (Milestone 3 part 4): Clear & complete. Our assessment of whether the website gives enough detail on
 * the approved decision facts, each AI's answers from the website alone (no tools), and the scores.
 */
export const contentModule: EngineModule = {
  id: "content",
  label: "Website content",
  stages: CONTENT_STAGES,
};
