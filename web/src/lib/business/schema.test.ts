import { describe, expect, it } from "vitest";
import { businessInput, fieldErrors, normalizeDomain, normalizeWebsite, splitList } from "./schema";

const valid = {
  name: "  Brownstone   Movers ",
  website: "brownstonemovers.com",
  category: "Moving company",
  location: "Brooklyn, NY",
  services: "Local moves\nPacking, Storage\npacking",
};

describe("splitList", () => {
  it("splits on newlines, commas and semicolons, trims and de-duplicates case-insensitively", () => {
    expect(splitList(" a, b\n\nB ;c ")).toEqual(["a", "b", "c"]);
    expect(splitList(undefined)).toEqual([]);
  });
});

describe("normalizeWebsite", () => {
  it("adds https and drops fragments", () => {
    expect(normalizeWebsite("example.com")).toBe("https://example.com/");
    expect(normalizeWebsite("http://example.com/a#x")).toBe("http://example.com/a");
    expect(normalizeWebsite("  ")).toBeNull();
  });
  it("rejects non-web schemes and hosts without a dot", () => {
    expect(() => normalizeWebsite("ftp://example.com")).toThrow();
    expect(() => normalizeWebsite("localhost")).toThrow();
  });
});

describe("normalizeDomain", () => {
  it("strips scheme, path and www", () => {
    expect(normalizeDomain("https://www.Example.com/path")).toBe("example.com");
    expect(normalizeDomain("shop.example.co.uk")).toBe("shop.example.co.uk");
  });
  it("rejects junk", () => {
    expect(() => normalizeDomain("not a domain")).toThrow();
    expect(() => normalizeDomain("-bad.com")).toThrow();
  });
});

describe("businessInput", () => {
  it("normalizes a valid business", () => {
    const b = businessInput.parse(valid);
    expect(b.name).toBe("Brownstone Movers");
    expect(b.website).toBe("https://brownstonemovers.com/");
    expect(b.services).toEqual(["Local moves", "Packing", "Storage"]);
    expect(b.domains).toEqual(["brownstonemovers.com"]);
    expect(b.service_area).toBeNull();
    expect(b.aliases).toEqual([]);
  });

  it("keeps extra domains after the website's own domain, without duplicates", () => {
    const b = businessInput.parse({ ...valid, domains: "www.brownstonemovers.com, brownstone-storage.com" });
    expect(b.domains).toEqual(["brownstonemovers.com", "brownstone-storage.com"]);
  });

  it("allows a business without a website", () => {
    const b = businessInput.parse({ ...valid, website: "" });
    expect(b.website).toBeNull();
    expect(b.domains).toEqual([]);
  });

  it("reports field errors for missing required fields and bad values", () => {
    const r = businessInput.safeParse({ name: " ", category: "", location: "x", website: "ftp://x.com", domains: "bad domain" });
    expect(r.success).toBe(false);
    if (r.success) return;
    const errors = fieldErrors(r.error);
    expect(errors.name).toBe("Business name is required");
    expect(errors.category).toBe("Category is required");
    expect(errors.website).toMatch(/http or https/);
    expect(errors.domains).toMatch(/not a valid domain/);
  });

  it("rejects missing required keys", () => {
    const r = businessInput.safeParse({});
    expect(r.success).toBe(false);
  });
});
