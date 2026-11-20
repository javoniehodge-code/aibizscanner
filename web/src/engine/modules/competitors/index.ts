import type { EngineModule } from "../types";
import { COMPETITOR_STAGES } from "./stages";

/**
 * Competitor comparison (Milestone 5, stage 10): the two businesses AI recommends most in the main service line (or
 * the two an admin chooses), their facts from their own pages AI cited, and why AI recommends each. Plain code builds
 * the comparison.
 */
export const competitorsModule: EngineModule = {
  id: "competitors",
  label: "Competitor comparison",
  stages: COMPETITOR_STAGES,
};
