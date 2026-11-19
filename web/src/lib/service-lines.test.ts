// The prompts page's service-lines form (owner decision, 19 Nov 2026): one line per service, questions by id.
import { describe, expect, it } from "vitest";
import { shownLines } from "@/engine/modules/prompt-analysis/lines-stage";
import { formatServiceLines, parseServiceLines } from "./service-lines";

describe("service lines", () => {
  it("parses the form, checks ids against the prompt set, and shows only lines with 3+ questions", () => {
    const r = parseServiceLines("Car rental | P1, P2,p4 P5\nVillas | P6\n\nPackages|P10", ["P1", "P2", "P4", "P5", "P6", "P10"]);
    expect(r).toEqual({ ok: true, value: { lines: [{ name: "Car rental", questions: ["P1", "P2", "P4", "P5"] }, { name: "Villas", questions: ["P6"] }, { name: "Packages", questions: ["P10"] }] } });
    expect(shownLines(r.ok ? r.value : { lines: [] }).map((l) => l.name)).toEqual(["Car rental"]);
    expect(parseServiceLines("Yachts | P7, P99", ["P7"])).toEqual({ ok: false, errors: ["Line 1 (Yachts): P99 isn't a question in the prompt set."] });
    expect(parseServiceLines("Just a name", ["P1"])).toEqual({ ok: false, errors: ['Line 1: write it as "Name | P1, P2, P5".'] });
    expect(parseServiceLines("Cars | P1\ncars | P2", ["P1", "P2"])).toEqual({ ok: false, errors: ['Line "cars" is listed twice'] });
    expect(formatServiceLines(r.ok ? r.value : null)).toBe("Car rental | P1, P2, P4, P5\nVillas | P6\nPackages | P10");
  });
});

