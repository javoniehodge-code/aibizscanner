import type { JsonValue } from "./types";

/** Deterministic JSON: object keys sorted recursively. Used for hashing. */
export function stableStringify(value: JsonValue): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const keys = Object.keys(value).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(value[k] as JsonValue)}`).join(",")}}`;
}

/** SHA-256 hex via Web Crypto (available in Node 20+, edge runtimes and browsers). */
export async function sha256Hex(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text);
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function hashJson(value: JsonValue): Promise<string> {
  return sha256Hex(stableStringify(value));
}
