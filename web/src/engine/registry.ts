import type { StageDefinition, StageId } from "./types";

export type StageRegistry = {
  readonly stages: readonly StageDefinition[];
  get(id: StageId): StageDefinition | undefined;
  /** Every stage that reads `id`'s output directly or transitively. */
  downstreamOf(id: StageId): StageId[];
};

/** Builds a registry, refusing duplicate ids, unknown inputs and cycles. */
export function createRegistry(stages: readonly StageDefinition[]): StageRegistry {
  const byId = new Map<StageId, StageDefinition>();
  for (const s of stages) {
    if (byId.has(s.id)) throw new Error(`Duplicate stage id: ${s.id}`);
    byId.set(s.id, s);
  }
  for (const s of stages) {
    for (const input of s.inputs) {
      if (!byId.has(input)) throw new Error(`Stage ${s.id} reads unknown stage ${input}`);
    }
  }

  const children = new Map<StageId, StageId[]>();
  for (const s of stages) for (const input of s.inputs) children.set(input, [...(children.get(input) ?? []), s.id]);

  // Cycle check (depth-first, three colours).
  const state = new Map<StageId, "visiting" | "done">();
  const visit = (id: StageId, path: StageId[]) => {
    if (state.get(id) === "done") return;
    if (state.get(id) === "visiting") throw new Error(`Stage cycle: ${[...path, id].join(" -> ")}`);
    state.set(id, "visiting");
    for (const c of children.get(id) ?? []) visit(c, [...path, id]);
    state.set(id, "done");
  };
  for (const s of stages) visit(s.id, []);

  return {
    stages,
    get: (id) => byId.get(id),
    downstreamOf(id) {
      const out: StageId[] = [];
      const queue = [...(children.get(id) ?? [])];
      while (queue.length) {
        const next = queue.shift() as StageId;
        if (out.includes(next)) continue;
        out.push(next);
        queue.push(...(children.get(next) ?? []));
      }
      return out;
    },
  };
}
