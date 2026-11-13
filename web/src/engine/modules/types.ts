import type { StageDefinition } from "../types";

/** A module groups the stages of one report area (prompt analysis, website audit, …). See engine/README.md. */
export type EngineModule = {
  id: string;
  label: string;
  stages: readonly StageDefinition[];
};
