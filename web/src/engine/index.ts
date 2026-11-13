import { MODULES } from "./modules";
import { createRegistry } from "./registry";

/**
 * The report engine's stage registry, built from the modules in ./modules. Milestone 1 has only the dummy module;
 * the pipeline stages of the brief (docs/build/internal-testing-app.md §4) are added as modules as they are built.
 */
export const registry = createRegistry(MODULES.flatMap((m) => m.stages));

export { executeRun, SchemaError, type RunOutcome, type Clock } from "./execute";
export { inputsHash } from "./hash";
export { estimateCostUsd, backoffMs } from "./cost";
export { instructionRef, defineInstruction, type LlmClient, type ModelSpec, type Instruction, type LlmCallRecord } from "./llm";
export { MODULES } from "./modules";
export type * from "./types";
