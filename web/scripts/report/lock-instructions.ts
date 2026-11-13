// Adds new instruction versions to web/src/engine/instructions.lock.json. Never rewrites a locked version: if the text
// of a locked version changed, bump its version instead. Run: npm run instructions:lock
import fs from "node:fs";
import path from "node:path";
import type { InstructionLock } from "../../src/engine/instructions-lock";
import { instructionRef } from "../../src/engine/llm";
import { allInstructions } from "../../src/engine/modules";

async function main() {
  const file = path.resolve(__dirname, "../../src/engine/instructions.lock.json");
  const lock: InstructionLock = JSON.parse(fs.readFileSync(file, "utf8"));
  let added = 0;
  for (const i of allInstructions()) {
    const key = `${i.id}@${i.version}`;
    const { sha256 } = await instructionRef(i);
    if (lock[key] && lock[key] !== sha256) {
      throw new Error(`${key}: text changed under a locked version. Bump the version in the instruction file.`);
    }
    if (!lock[key]) {
      lock[key] = sha256;
      added++;
    }
  }
  const sorted = Object.fromEntries(Object.entries(lock).sort(([a], [b]) => a.localeCompare(b)));
  fs.writeFileSync(file, JSON.stringify(sorted, null, 2) + "\n");
  console.log(`instructions.lock.json: ${added} added, ${Object.keys(sorted).length} total`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
