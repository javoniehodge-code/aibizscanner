// Website: the JavaScript check (our raw fetch vs the same page after scripts ran). Plain code, no model.
import { describe, expect, it } from "vitest";
import { compareTexts, keyFacts, verdictLabel } from "../logic/jscheck";

describe("JavaScript check", () => {
  it("flags the MVP Miami /rentals case: inventory and prices appear only after scripts run", () => {
    const raw = "Exotic Car Rentals Miami\nMake\nModel\nPrice\nVehicles Found:";
    const rendered = [
      "Exotic Car Rentals Miami",
      "Make",
      "Model",
      "Price",
      "Vehicles Found: 42",
      "Lamborghini Huracan EVO Spyder $1,495/day",
      "Rolls-Royce Cullinan $1,995 per day",
      "Ferrari 296 GTB $2,250/day",
    ].join("\n");
    const c = compareTexts(raw, rendered);
    expect(c.verdict).toBe("key_facts_need_js");
    expect(c.keyFactsOnlyRendered.map((f) => f.text)).toEqual(["$1,495/day", "$1,995 per day", "$2,250/day"]);
    expect(c.reason).toBe("Prices appear only after scripts run (3 found, e.g. $1,495/day).");
    expect(c.onlyRendered).toContain("Vehicles Found: 42");
    expect(verdictLabel(c.verdict)).toBe("Key facts load with JavaScript: likely invisible to ChatGPT and Claude");
  });

  it("doesn't count re-wrapped text, or a price already in the page, as new", () => {
    const raw = "Our rates start at $995 per day.\nCall (305) 555-0100 to book.";
    const rendered = "Our rates start at\n$995 per day.\nCall (305) 555-0100\nto book.";
    expect(compareTexts(raw, rendered)).toMatchObject({ verdict: "same", addedWords: 0, keyFactsOnlyRendered: [] });
    // The same price repeated in a script-built widget isn't a new fact.
    expect(compareTexts(raw, `${rendered}\nFrom $995 per day`).keyFactsOnlyRendered).toEqual([]);
  });

  it("separates lots of script-only text from a little", () => {
    const raw = "Welcome to our shop.";
    const many = Array.from({ length: 12 }, (_, i) => `Review ${i + 1}: great service and friendly staff every single time we visit`).join("\n");
    expect(compareTexts(raw, `${raw}\n${many}`)).toMatchObject({ verdict: "content_needs_js" });
    expect(compareTexts(raw, `${raw}\nAccept cookies`)).toMatchObject({ verdict: "minor", addedWords: 2 });
  });

  it("finds prices, US phone numbers and opening hours", () => {
    const f = keyFacts(["Open 9am - 6pm daily", "Call +1 (786) 555-0199", "Yacht charter US$3,500 per hour", "Since 2015, 1200 happy clients"]);
    expect(f.map((x) => [x.kind, x.text])).toEqual([
      ["hours", "9am - 6pm"],
      ["phone", "+1 (786) 555-0199"],
      ["price", "US$3,500 per hour"],
    ]);
  });
});
