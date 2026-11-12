// Writes fixtures/report.schema.json from the zod schema (web/src/report/schema.ts). Run: npm run report:schema
import fs from "node:fs";
import path from "node:path";
import { reportJsonSchema } from "../../src/report/json-schema";

const out = path.resolve(__dirname, "../../../fixtures/report.schema.json");
fs.writeFileSync(out, JSON.stringify(reportJsonSchema(), null, 2) + "\n");
console.log("wrote", path.relative(process.cwd(), out));
