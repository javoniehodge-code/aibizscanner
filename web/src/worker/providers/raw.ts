import type { JsonValue } from "@/engine";

/** Opaque fields that are large and useless as evidence (encrypted search content, thinking signatures). */
const DROP = new Set(["encrypted_content", "encrypted_index", "signature", "thought_signature", "thoughtSignature"]);

/** A provider response as plain JSON, without opaque blobs: stored with each answer as evidence. */
export function trimRaw(value: unknown): JsonValue {
  return JSON.parse(JSON.stringify(value ?? null, (key, v: unknown) => (DROP.has(key) ? undefined : v))) as JsonValue;
}

/** Unique values in first-seen order. */
export function unique(values: Iterable<string>): string[] {
  return [...new Set(values)];
}
