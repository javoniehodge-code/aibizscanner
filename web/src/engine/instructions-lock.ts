import { instructionRef, type Instruction } from "./llm";

/** instructions.lock.json: "id@version" -> sha256 of the text. Old versions stay listed after the code moves on. */
export type InstructionLock = Record<string, string>;

/**
 * Problems that make the lockfile disagree with the code: a version whose text changed without a version bump, or a
 * version not yet locked. Run `npm run instructions:lock` to add new versions; it never rewrites an existing one.
 */
export async function checkInstructionLock(instructions: readonly Instruction[], lock: InstructionLock): Promise<string[]> {
  const problems: string[] = [];
  for (const i of instructions) {
    const ref = await instructionRef(i);
    const key = `${i.id}@${i.version}`;
    const locked = lock[key];
    if (!locked) problems.push(`${key} is not in instructions.lock.json (run npm run instructions:lock)`);
    else if (locked !== ref.sha256) problems.push(`${key} text changed but its version didn't: bump the version`);
  }
  return problems;
}
