import { timingSafeEqual } from "node:crypto";

/** Constant-time check of an `Authorization: Bearer <secret>` header. */
export function hasBearerSecret(header: string | null, secret: string): boolean {
  if (!header || !secret) return false;
  const match = /^Bearer (.+)$/.exec(header.trim());
  if (!match?.[1]) return false;
  const given = Buffer.from(match[1]);
  const expected = Buffer.from(secret);
  return given.length === expected.length && timingSafeEqual(given, expected);
}
