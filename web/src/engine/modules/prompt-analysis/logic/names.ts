/** A business the report knows: the target or one already named in another answer. */
export type KnownBusiness = { key: string; name: string; aliases?: readonly string[] };

const STOP = new Set(["the", "inc", "llc", "ltd", "co", "company", "corp", "corporation"]);

/** "Red Hook Moving Co." -> "red hook moving"; "Bushwick Box & Truck" -> "bushwick box and truck". */
export function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/&/g, " and ")
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .filter((w) => w && !STOP.has(w))
    .join(" ");
}

/** Key of the known business this name refers to (exact match on the normalized name or an alias), or null. */
export function matchBusiness(name: string, known: readonly KnownBusiness[]): string | null {
  const n = normalizeName(name);
  if (!n) return null;
  for (const b of known) {
    if ([b.name, ...(b.aliases ?? [])].some((x) => normalizeName(x) === n)) return b.key;
  }
  return null;
}

/** A new short upper-case key ("Red Hook Moving Co." -> "RHM"), unique among `taken`. Matches the report schema. */
export function newBusinessKey(name: string, taken: ReadonlySet<string>): string {
  const words = normalizeName(name).split(" ").filter(Boolean);
  let base = words.map((w) => w[0]!.toUpperCase()).join("").replace(/[^A-Z0-9]/g, "").slice(0, 4);
  if (base.length < 2) base = (words[0] ?? "biz").replace(/[^a-z0-9]/g, "").slice(0, 3).toUpperCase().padEnd(2, "X");
  if (!/^[A-Z]/.test(base)) base = "B" + base.slice(0, 3);
  if (!taken.has(base)) return base;
  for (let i = 2; i < 100; i++) {
    const k = base.slice(0, 4) + i;
    if (!taken.has(k)) return k;
  }
  throw new Error("Could not make a unique business key for " + name);
}
