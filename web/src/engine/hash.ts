import { hashJson } from "./json";
import type { JsonObject, StageId, StageInput } from "./types";

/**
 * Inputs hash for a stage run: the stage, its params and the identity and content of every upstream output it reads.
 * Two runs with the same hash saw the same inputs.
 */
export async function inputsHash(stage: StageId, params: JsonObject, inputs: readonly StageInput[]): Promise<string> {
  const sorted = [...inputs]
    .sort((a, b) => a.stage.localeCompare(b.stage))
    .map((i) => ({ stage: i.stage, runId: i.runId, outputHash: i.outputHash }));
  return hashJson({ stage, params, inputs: sorted });
}
