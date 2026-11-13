import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { forEachEnvelope, reportDocument, stripProvenance, type Provenance } from "./schema";

const fixture = (name: string) => JSON.parse(fs.readFileSync(path.resolve(__dirname, "../../../fixtures", name), "utf8"));
const brownstone = fixture("brownstone.json");
const mvp = fixture("mvp-miami.json");

function provenanceKinds(doc: unknown) {
  const kinds: Record<string, number> = {};
  forEachEnvelope(doc, (env) => {
    kinds[env.p.kind] = (kinds[env.p.kind] ?? 0) + 1;
  });
  return kinds;
}

function envelopeAt(doc: unknown, wanted: string): { v: unknown; p: Provenance } {
  let found: { v: unknown; p: Provenance } | undefined;
  forEachEnvelope(doc, (env, at) => {
    if (at === wanted) found = env;
  });
  if (!found) throw new Error("No envelope at " + wanted);
  return found;
}

describe("report fixtures", () => {
  it.each([
    ["brownstone", brownstone],
    ["mvp-miami", mvp],
  ])("%s validates against the report schema", (_name, doc) => {
    const result = reportDocument.safeParse(doc);
    if (!result.success) throw new Error(JSON.stringify(result.error.issues.slice(0, 5), null, 2));
  });

  it("every value is inside a provenance envelope (no bare strings outside envelopes except structural metadata)", () => {
    for (const doc of [brownstone, mvp]) {
      const rest = Object.fromEntries(Object.entries(doc).filter(([k]) => !["fixture", "evidence", "schemaVersion"].includes(k)));
      const bare: string[] = [];
      const walk = (x: unknown, at: string, inside: boolean): void => {
        if (Array.isArray(x)) return x.forEach((y, i) => walk(y, `${at}[${i}]`, inside));
        if (x && typeof x === "object") {
          const o = x as Record<string, unknown>;
          if (Object.keys(o).length === 2 && "v" in o && "p" in o) return walk(o.v, at + ".v", true);
          for (const [k, v] of Object.entries(o)) walk(v, `${at}.${k}`, inside);
          return;
        }
        if (!inside) bare.push(at);
      };
      walk(rest, "$", false);
      expect(bare).toEqual([]);
    }
  });

  it("Brownstone is all sample data, apart from the labeled local-business assumption", () => {
    expect(provenanceKinds(brownstone)).toEqual({ sample: expect.any(Number), assumed: 1 });
    expect(envelopeAt(brownstone, "$.promptAnalysis.localAssumption").p).toMatchObject({ kind: "assumed", rule: expect.stringContaining("Gemini") });
  });

  it("MVP Miami marks LOCAL, XSRC and PA_N missing with reasons, never Brownstone values", () => {
    for (const at of ["$.promptAnalysis.localAssumption", "$.promptAnalysis.uncitedSources", "$.promptAnalysis.run"]) {
      const env = envelopeAt(mvp, at);
      expect(env.v).toBeNull();
      expect(env.p).toMatchObject({ kind: "missing", reason: expect.stringMatching(/\S/) });
    }
    const content = { ...mvp, fixture: undefined };
    const text = JSON.stringify(stripProvenance(content));
    for (const brownstoneOnly of ["Brownstone", "Brooklyn", "NYSDOT", "walk-up", "29 Oct 2026"]) expect(text).not.toContain(brownstoneOnly);
  });

  it("MVP Miami: Claude answers are observed with registered evidence; ChatGPT and Gemini answers are sample", () => {
    for (const q of mvp.promptAnalysis.questions) {
      expect(q.answers.map((a: { p: Provenance }) => a.p.kind)).toEqual(["sample", "observed", "sample"]);
    }
    expect(Object.keys(mvp.evidence)).toEqual(expect.arrayContaining(["mvp-claude-live", "mvp-site-checks"]));
  });

  it("rejects observed values whose evidence isn't registered, and mismatched run counts", () => {
    const bad = structuredClone(brownstone);
    bad.business.p = { kind: "observed", evidence: ["nope"] };
    bad.promptAnalysis.run.v.usable = 99;
    const result = reportDocument.safeParse(bad);
    expect(result.success).toBe(false);
    const messages = result.error?.issues.map((i) => i.message).join("\n");
    expect(messages).toMatch(/Unknown evidence id "nope"/);
    expect(messages).toMatch(/run.usable is 99 but the answers give 23/);
  });

  it("rejects missing values outside the fields that allow them, and missing without a reason", () => {
    const bad = structuredClone(brownstone);
    bad.business = { v: null, p: { kind: "missing", reason: "x" } };
    expect(reportDocument.safeParse(bad).success).toBe(false);
    const bad2 = structuredClone(mvp);
    bad2.promptAnalysis.run.p = { kind: "missing" };
    expect(reportDocument.safeParse(bad2).success).toBe(false);
  });

  it("stripProvenance yields plain values and nulls for missing", () => {
    const plain = stripProvenance(mvp) as { business: { name: string }; promptAnalysis: { run: unknown } };
    expect(plain.business.name).toBe("MVP Miami");
    expect(plain.promptAnalysis.run).toBeNull();
  });
});

describe("JSON Schema export", () => {
  it("fixtures/report.schema.json is up to date (run `npm run report:schema`)", async () => {
    const { reportJsonSchema } = await import("./json-schema");
    const committed = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../../../fixtures/report.schema.json"), "utf8"));
    expect(committed).toEqual(JSON.parse(JSON.stringify(reportJsonSchema())));
  });
});
