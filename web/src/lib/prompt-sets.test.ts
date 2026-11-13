import { describe, expect, it } from "vitest";
import { examplePromptSet, formatGroups, formatPrompts, parsePromptSetForm } from "./prompt-sets";

const loc = { city: "Miami", region: "Florida", country: "us", timezone: "America/New_York" };

describe("prompt set form", () => {
  it("round-trips the example set and numbers questions in order", () => {
    const ex = examplePromptSet();
    expect(ex.prompts).toHaveLength(12);
    const parsed = parsePromptSetForm({ groups: formatGroups(ex.groups), prompts: formatPrompts(ex.prompts), ...loc });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.value.prompts.map((p) => p.id)).toEqual(ex.prompts.map((_, i) => `P${i + 1}`));
    expect(parsed.value.prompts.map((p) => [p.group, p.text])).toEqual(ex.prompts.map((p) => [p.group, p.text]));
    expect(parsed.value.location).toEqual({ ...loc, country: "US" });
  });

  it("reports every problem with its line", () => {
    const r = parsePromptSetForm({
      groups: "Baseline | General\nNo description",
      prompts: "1 | Observed | Best car rental in Miami\n5 | Observed | Yachts?\n1 | Observed | best car rental in miami",
      city: "Miami",
      region: "",
      country: "USA",
      timezone: "Miami",
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errors).toEqual([
      'Group line 2: write "Name | description".',
      "Question line 2: group must be a number from 1 to 2.",
      "Question line 3 repeats an earlier question.",
      "Customer location: give the city and region, or leave all location fields empty.",
      "Customer location: country must be a two-letter code, e.g. US.",
      "Customer location: time zone must be an IANA name, e.g. America/New_York.",
    ]);
  });

  it("allows no location at all, and keeps pipes inside a question", () => {
    const r = parsePromptSetForm({ groups: "A | b", prompts: "1 | d | x | y", city: "", region: "", country: "", timezone: "" });
    expect(r).toEqual({ ok: true, value: { groups: [{ name: "A", description: "b" }], prompts: [{ id: "P1", group: 0, demand: "d", text: "x | y" }], location: null } });
  });
});
