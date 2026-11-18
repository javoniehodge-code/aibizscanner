import type { EngineModule } from "../types";
import { DISTINCTIVE_STAGES } from "./distinctive";
import { CONTENT_STAGES } from "./stages";

/**
 * Website content (Milestone 3 part 4): Clear & complete, and Distinctive. Our assessment of whether the website gives enough detail on
 * the approved decision facts, each AI's answers from the website alone (no tools), and the scores.
 */
export const contentModule: EngineModule = {
  id: "content",
  label: "Website content",
  stages: [...CONTENT_STAGES, ...DISTINCTIVE_STAGES],
};
