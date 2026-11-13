import type { Instruction } from "../llm";
import { dummyModule } from "./dummy";
import { promptAnalysisModule } from "./prompt-analysis";
import type { EngineModule } from "./types";

/** Every module of the report engine, in pipeline order. Add a module here and its stages join the registry. */
export const MODULES: readonly EngineModule[] = [dummyModule, promptAnalysisModule];

/** Every instruction any registered stage declares (checked against instructions.lock.json by a unit test). */
export function allInstructions(modules: readonly EngineModule[] = MODULES): Instruction[] {
  const seen = new Map<string, Instruction>();
  for (const m of modules) {
    for (const s of m.stages) {
      if (s.module !== m.id) throw new Error(`Stage ${s.id} says module "${s.module}" but is listed in "${m.id}"`);
      for (const i of s.instructions ?? []) {
        const key = `${i.id}@${i.version}`;
        const prior = seen.get(key);
        if (prior && prior.text !== i.text) throw new Error(`Two different texts for instruction ${key}`);
        seen.set(key, i);
      }
    }
  }
  return [...seen.values()];
}
