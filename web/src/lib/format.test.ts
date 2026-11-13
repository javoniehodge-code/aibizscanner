import { describe, expect, it } from "vitest";
import { formatCount, formatDuration, formatUsd } from "./format";

describe("format", () => {
  it("formats USD for tiny and normal amounts", () => {
    expect(formatUsd(0)).toBe("$0.00");
    expect(formatUsd("0.0118")).toBe("$0.0118");
    expect(formatUsd(0.000123)).toBe("$0.000123");
    expect(formatUsd(null)).toBe("$0.00");
  });
  it("formats durations", () => {
    expect(formatDuration(null)).toBe("—");
    expect(formatDuration(250)).toBe("250 ms");
    expect(formatDuration(1500)).toBe("1.5 s");
    expect(formatDuration(125_000)).toBe("2 min 5 s");
  });
  it("formats counts", () => {
    expect(formatCount(12345)).toBe("12,345");
  });
});
