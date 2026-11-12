import { describe, expect, it } from "vitest";
import { hasBearerSecret } from "./bearer";

describe("hasBearerSecret", () => {
  const secret = "s".repeat(40);
  it("accepts the exact secret", () => {
    expect(hasBearerSecret(`Bearer ${secret}`, secret)).toBe(true);
  });
  it.each([null, "", secret, `Basic ${secret}`, `Bearer ${secret}x`, "Bearer ", `bearer ${secret}`])(
    "rejects %s",
    (header) => {
      expect(hasBearerSecret(header, secret)).toBe(false);
    },
  );
  it("rejects everything when no secret is configured", () => {
    expect(hasBearerSecret("Bearer ", "")).toBe(false);
  });
});
