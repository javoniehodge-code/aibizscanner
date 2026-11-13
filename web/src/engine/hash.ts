import { hashJson } from "./json";
import type { InstructionRef, JsonObject, StageId, StageInput } from "./types";

/**
 * Inputs hash for a stage run: the stage, its params, the identity and content of every upstream output it reads, and
 * the exact instruction versions it uses. Two runs with the same hash saw the same inputs and instructions.
 */
export async function inputsHash(
  stage: StageId,
  params: JsonObject,
  inputs: readonly StageInput[],
  instructions: readonly InstructionRef[] = [],
): Promise<string> {
  const sorted = [...inputs]
    .sort((a, b) => a.stage.localeCompare(b.stage))
    .map((i) => ({ stage: i.stage, runId: i.runId, outputHash: i.outputHash }));
  const base = { stage, params, inputs: sorted };
  // Stages without instructions keep the hash they had before instructions existed.
  if (instructions.length === 0) return hashJson(base);
  const instr = [...instructions].sort((a, b) => a.id.localeCompare(b.id)).map((i) => ({ id: i.id, version: i.version, sha256: i.sha256 }));
  return hashJson({ ...base, instructions: instr });
}
