import type { EngineModule } from "../types";
import { dummyPricedCall, dummySummary } from "./stages";

/**
 * Milestone 1 example module: proves the queue, retries, cost logging and stale marking without calling any AI API.
 * Layout for real modules: see engine/README.md.
 */
export const dummyModule: EngineModule = {
  id: "dummy",
  label: "Dummy (pipeline test)",
  stages: [dummyPricedCall, dummySummary],
};
