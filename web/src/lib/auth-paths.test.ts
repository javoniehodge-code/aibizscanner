import { describe, expect, it } from "vitest";
import { isPublicPath, safeNextPath } from "./auth-paths";

describe("isPublicPath", () => {
  it("only /login is public", () => {
    expect(isPublicPath("/login")).toBe(true);
    for (const p of ["/", "/health", "/businesses", "/no-access", "/login/x", "/api/anything"]) {
      expect(isPublicPath(p)).toBe(false);
    }
  });
});

describe("safeNextPath", () => {
  it.each([
    [undefined, "/"],
    ["", "/"],
    ["/health", "/health"],
    ["/reports/abc?x=1", "/reports/abc?x=1"],
    ["//evil.example", "/"],
    ["/\\evil.example", "/"],
    ["https://evil.example", "/"],
    ["/login", "/"],
  ])("%s -> %s", (input, expected) => {
    expect(safeNextPath(input)).toBe(expected);
  });
});

describe("isSelfAuthenticatedPath", () => {
  it("only the worker API authenticates itself (bearer token)", async () => {
    const { isSelfAuthenticatedPath } = await import("./auth-paths");
    expect(isSelfAuthenticatedPath("/api/worker/tick")).toBe(true);
    expect(isSelfAuthenticatedPath("/api/worker")).toBe(true);
    expect(isSelfAuthenticatedPath("/api/workers")).toBe(false);
    expect(isSelfAuthenticatedPath("/health")).toBe(false);
  });
});
