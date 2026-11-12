import { createRegistry } from "./registry";
import { dummyPricedCall, dummySummary } from "./stages/dummy";

/**
 * The report engine's stage registry. Milestone 1 registers only the dummy stages; the 12 pipeline stages of the brief
 * (docs/build/internal-testing-app.md §4) are added here as they are built.
 */
export const registry = createRegistry([dummyPricedCall, dummySummary]);

export { executeRun, type RunOutcome, type Clock } from "./execute";
export { inputsHash } from "./hash";
export { estimateCostUsd, backoffMs } from "./cost";
export type * from "./types";
