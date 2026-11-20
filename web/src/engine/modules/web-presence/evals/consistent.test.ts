// Consistent & current (part 4c-1): values are kept only when the page backs them, and plain code compares them like
// for like. Owner decision (20 Nov 2026): Agree or Don't agree; facts with nothing to compare are listed separately.
import { describe, expect, it } from "vitest";
import { checkValue, checkValues, type ReadValue } from "../../content/values";
import { STANDARDS } from "../../content/standards";
import { addressKey, buildConsistent, compareFact } from "../logic/consistent";
import type { CitedPages } from "../schemas";

const v = (fact: string, value: string, quote: string, more: Partial<ReadValue> = {}): ReadValue => ({ fact, ref: null, value, amount: null, unit: null, item: null, quote, ...more });
const PAGE =
  "Call us at (305) 555-0100 to book. Visit us at 2322 NW 7th Ct, Miami. Renters must be 25 years or older. A security deposit of $1,500 is required. Lamborghini Urus from $995 per day. Chauffeur service available on request.";

describe("checking a value against its page", () => {
  it("keeps a value only when its quote is on the page and the value is in the quote", () => {
    expect(checkValue(v("booking-contact", "(305) 555-0100", "Call us at (305) 555-0100"), "phone", PAGE).value).not.toBeNull();
    expect(checkValue(v("booking-contact", "(305) 555-0199", "Call us at (305) 555-0100"), "phone", PAGE).dropped).toMatch(/number isn't in the quote/);
    expect(checkValue(v("booking-contact", "(305) 555-0100", "Phone us any time at (305) 555-0100"), "phone", PAGE).dropped).toMatch(/quote not on the page/);
    expect(checkValue(v("deposit-payment", "$1,500", "A security deposit of $1,500", { amount: 1500, unit: "USD" }), "money", PAGE).value?.amount).toBe(1500);
    expect(checkValue(v("deposit-payment", "$2,500", "A security deposit of $1,500", { amount: 2500 }), "money", PAGE).dropped).toMatch(/amount isn't in the quote/);
    expect(checkValue(v("requirements", "25 years", "must be 25 years or older", { amount: 25, unit: "years" }), "number", PAGE).value).not.toBeNull();
    expect(checkValue(v("prices", "$995 per day", "Lamborghini Urus from $995 per day", { amount: 995, unit: "day", item: "Lamborghini Urus" }), "price", PAGE).value).not.toBeNull();
    expect(checkValue(v("prices", "$995 per day", "Urus from $995 per day", { amount: 995, unit: "day", item: "Ferrari Roma" }), "price", PAGE).dropped).toMatch(/vehicle isn't on the page/);
    expect(checkValue(v("chauffeur", "maybe", "Chauffeur service available on request"), "yes-no", PAGE).dropped).toMatch(/"yes" or "no"/);
    expect(checkValue(v("delivery-locations", "2322 NW 7th Ct", "Visit us at 2322 NW 7th Ct, Miami"), "address", PAGE).value).not.toBeNull();
  });

  it("drops values for facts that aren't compared, or from a page it can't find", () => {
    const r = checkValues([v("vehicles", "Lamborghini Urus", "Lamborghini Urus from $995 per day"), v("weather", "sunny", "Visit us at 2322 NW 7th Ct")], "car-rental", (x) => (x.ref === "P9" ? null : PAGE));
    expect(r.values.map((x) => x.fact)).toEqual(["vehicles"]);
    expect(r.dropped).toEqual(["weather: not a compared fact"]);
    expect(checkValues([v("vehicles", "Lamborghini Urus", "Lamborghini Urus from $995 per day", { ref: "P9" })], "car-rental", (x) => (x.ref === "P9" ? null : PAGE)).dropped[0]).toMatch(/unknown page P9/);
  });
});

const c = (fact: string, value: string, more: Partial<ReadValue> = {}) => ({ ...v(fact, value, value), ...more });

describe("comparing like for like", () => {
  it("phones by digits, addresses by street, numbers by amount", () => {
    expect(compareFact("phone", [c("p", "(305) 555-0100")], [c("p", "+1 305-555-0100")]).mark).toBe("g");
    expect(compareFact("phone", [c("p", "(305) 555-0100")], [c("p", "305.555.0199")])).toMatchObject({ mark: "r", text: "305.555.0199" });
    expect(addressKey("2322 Northwest 7th Court, Suite 4, Miami, FL 33127")).toBe(addressKey("2322 NW 7th Ct"));
    expect(compareFact("address", [c("a", "2322 NW 7th Ct, Miami")], [c("a", "2322 Northwest 7th Court Suite 4")]).mark).toBe("g");
    expect(compareFact("address", [c("a", "2322 NW 7th Ct")], [c("a", "300 Alton Road")]).mark).toBe("r");
    expect(compareFact("number", [c("n", "25", { amount: 25 })], [c("n", "21", { amount: 21 })]).mark).toBe("r");
  });

  it("prices only for the same vehicle and unit of time", () => {
    const web = [c("pr", "$995/day", { item: "Lamborghini Urus", amount: 995, unit: "day" })];
    expect(compareFact("price", web, [c("pr", "$995 a day", { item: "Lamborghini Urus S", amount: 995, unit: "day" })]).mark).toBe("g");
    expect(compareFact("price", web, [c("pr", "$1,095 a day", { item: "Urus Lamborghini", amount: 1095, unit: "day" })]).mark).toBe("r");
    // A 4-hour price or another car is never compared with a daily price.
    expect(compareFact("price", web, [c("pr", "$450", { item: "Lamborghini Urus", amount: 450, unit: "hour" })]).mark).toBe("n");
    expect(compareFact("price", web, [c("pr", "$1,295", { item: "Lamborghini Huracan", amount: 1295, unit: "day" })]).mark).toBe("n");
    // One word ("Lamborghini") isn't enough to say it's the same vehicle.
    expect(compareFact("price", web, [c("pr", "$1,295", { item: "Lamborghini", amount: 1295, unit: "day" })]).mark).toBe("n");
  });

  it("lists item by item; a source silent on a fact, or a website without it, has nothing to compare", () => {
    const web = [c("l", "Lamborghini Urus"), c("l", "Rolls-Royce Cullinan")];
    expect(compareFact("list", web, [c("l", "Urus")]).mark).toBe("g");
    expect(compareFact("list", web, [c("l", "Ferrari 488")])).toMatchObject({ mark: "r" });
    expect(compareFact("list", web, [])).toEqual({ mark: "n", text: "Not mentioned", differs: [] });
    expect(compareFact("list", [], [c("l", "Ferrari 488")]).mark).toBe("n");
  });
});

describe("the Consistent & current part", () => {
  const car = STANDARDS.find((s) => s.id === "car-rental")!;
  const page = (key: string, site: string, state: "checked" | "unchecked" = "checked") => ({
    key, url: `https://${site}/${key}`, site, category: "dir" as const, title: null, prompts: 1, answers: 1, engines: [0], state, reason: null, source: null, excerpt: null, attempts: [], names: [],
  });
  const cited: CitedPages = { version: "x", cap: 20, outsidePages: 3, businesses: [{ key: "MM", name: "MVP Miami", target: true }], pages: [page("dr1", "carrentallist.com"), page("dr2", "carrentallist.com"), page("ed1", "respectmyregion.com"), page("dr3", "yelp.com", "unchecked")] };
  const reading = (values: ReadValue[]) => ({ presence: "list", detail: "", supports: "", reasons: [], concerns: [], recommendedInstead: [], columns: {} as never, review: null, overruled: [], values }) as never;
  const website = {
    values: [c("booking-contact", "(305) 555-0100", { ref: "P1" }), c("requirements", "25 years", { ref: "P2", amount: 25 }), c("prices", "$995/day", { ref: "P3", item: "Lamborghini Urus", amount: 995, unit: "day" })],
    pages: [{ ref: "P1", name: "Home" }, { ref: "P2", name: "FAQ" }, { ref: "P3", name: "Fleet" }],
    runId: "cv-1", finishedAt: "2026-11-20T10:00:00Z", model: "claude-sonnet-5-5",
  };

  it("one column per site that gives values; agree, don't agree, and the facts with nothing to compare", () => {
    const out = buildConsistent(
      {
        standard: car,
        website,
        cited,
        readings: [
          { key: "dr1", reading: reading([c("booking-contact", "305-555-0100"), c("requirements", "21+", { amount: 21 })]) },
          { key: "dr2", reading: reading([c("deposit-payment", "$2,000", { amount: 2000 })]) },
          { key: "ed1", reading: reading([c("booking-contact", "(305) 555-0100")]) },
        ],
      },
      ["website-values"],
    )!;
    expect(out.sources.map((s) => s.v)).toEqual([{ name: "carrentallist.com", sub: "Directory & marketplace" }, { name: "respectmyregion.com", sub: "Directory & marketplace" }]);
    const row = (name: string) => out.facts.find((f) => f.v.name === name)!.v;
    expect(row("How to book and contact")).toMatchObject({ status: "a", sources: [{ mark: "g" }, { mark: "g" }], website: { value: "(305) 555-0100", pages: "Home" } });
    expect(row("How to book and contact").means).toBe("2 other sources say the same as your website, so AI finds one consistent answer.");
    expect(row("Rental requirements")).toMatchObject({ status: "c", note: "carrentallist.com says 21+; your website says 25 years." });
    expect(out.facts).toHaveLength(2); // prices: no other source gives one
    expect(out.notMentioned!.map((n) => [n.v.name, n.v.note])).toEqual([
      ["Vehicles available", "Neither your website nor the other sources we read give this."],
      ["Prices and what's included", "No other source we read gives this."],
      ["Deposit and payment", "Your website doesn't give this; carrentallist.com says $2,000."],
      ["Delivery, pickup and areas served", "Neither your website nor the other sources we read give this."],
      ["Chauffeur or driver option", "Neither your website nor the other sources we read give this."],
      ["Cancellation and changes", "Neither your website nor the other sources we read give this."],
      ["Other services", "Neither your website nor the other sources we read give this."],
    ]);
    expect(out.verdict.v.heading).toBe("1 of 2 facts we could compare doesn't agree");
    expect(out.fixes.map((f) => f.v.title)).toEqual(["Correct the rental requirements on carrentallist.com"]);
  });

  it("reads plainly: a range is shown once, an unmatched price says why, and two agreeing facts are 'Both'", () => {
    const out = buildConsistent(
      {
        standard: car,
        website: {
          ...website,
          values: [...website.values, c("deposit-payment", "$1,000 – $7,000", { ref: "P2", amount: 1000 }), c("deposit-payment", "$1,000 – $7,000", { ref: "P2", amount: 7000 })],
        },
        cited,
        readings: [
          { key: "dr1", reading: reading([c("booking-contact", "305-555-0100"), c("requirements", "25+", { amount: 25 })]) },
          { key: "ed1", reading: reading([c("prices", "Approximately $400 to $1,200 per day", { item: "exotic cars", amount: 400, unit: "day" })]) },
        ],
      },
      [],
    )!;
    expect(out.verdict.v.heading).toBe("Both facts we could compare agree");
    const nm = (name: string) => out.notMentioned!.find((n) => n.v.name === name)!.v;
    expect(nm("Deposit and payment").website).toBe("$1,000 – $7,000");
    expect(nm("Prices and what's included").note).toBe("respectmyregion.com gives exotic cars: Approximately $400 to $1,200 per day, which isn't for the same vehicle and unit of time as your website, so it can't be compared.");
  });

  it("is left out when no outside site we read gives a compared fact about the business", () => {
    expect(buildConsistent({ standard: car, website, cited, readings: [{ key: "dr1", reading: reading([]) }] }, [])).toBeNull();
  });
});
