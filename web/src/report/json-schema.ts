import { z } from "zod";
import { reportDocument } from "./schema";

/** JSON Schema (draft 2020-12) for the report document. Cross-reference checks live in the zod schema only. */
export function reportJsonSchema() {
  return {
    ...z.toJSONSchema(reportDocument, { target: "draft-2020-12", unrepresentable: "any" }),
    $id: "https://aibizscanner.internal/schemas/report-document.json",
    title: "AIBizScanner Full Business Diagnostic report document",
  };
}
