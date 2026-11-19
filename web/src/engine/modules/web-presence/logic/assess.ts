import { z } from "zod";

/**
 * Checking a model's reading of one cited page (wp_assess). The model proposes; this code decides what counts:
 * every judgment needs words found on the page, and the name check (plain code) has the last word on whether the
 * business is on the page at all.
 */
export const COLUMNS = ["details", "services", "fit", "reviews", "recommendations", "locations"] as const;
export type Column = (typeof COLUMNS)[number];
export const PRESENCE = ["rec", "rev", "list", "mixed", "none"] as const;
export type Presence = (typeof PRESENCE)[number];

const text = z.string();
export const pageReading = z
  .object({
    presence: z.enum(PRESENCE),
    detail: text,
    supports: text,
    reasons: z.array(z.object({ reason: text, quote: text }).strict()),
    concerns: z.array(z.object({ concern: text, quote: text }).strict()),
    recommendedInstead: z.array(text),
    columns: z.array(
      z.object({ column: z.enum(COLUMNS), status: z.enum(["P", "L", "N", "A"]), says: text, quote: text.nullable(), issue: text.nullable(), action: text.nullable() }).strict(),
    ),
    review: z
      .object({ rating: text, scale: z.number().positive().nullable(), count: text.nullable(), recent: text.nullable(), themes: text, quote: text })
      .strict()
      .nullable(),
  })
  .strict();
export type PageReading = z.infer<typeof pageReading>;

/** The checked reading: what the report uses. `overruled` lists every change plain code made, for review. */
export type CheckedCell = { status: "P" | "L" | "N" | "A" | "U"; says: string; quote: string | null; issue: string | null; action: string | null };
export type CheckedReading = {
  presence: Presence;
  detail: string;
  supports: string;
  reasons: { reason: string; quote: string }[];
  concerns: { concern: string; quote: string }[];
  recommendedInstead: string[];
  columns: Record<Column, CheckedCell>;
  review: { rating: string; scale: number | null; count: string | null; recent: string | null; themes: string; quote: string } | null;
  overruled: string[];
};

const norm = (s: string) => s.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();

/** A quote counts when it has at least `min` words and appears word for word (letters and digits) in the page text. */
export function onPage(quote: string | null | undefined, pageText: string, min = 4): boolean {
  const q = norm((quote ?? "").replace(/\.{3}|…/g, " "));
  return q.split(" ").filter(Boolean).length >= min && ` ${norm(pageText)} `.includes(` ${q} `);
}

const plain = (s: string) => s.replace(/\s+/g, " ").trim();

export function checkReading(r: PageReading, pageText: string, targetNamed: boolean): CheckedReading {
  const overruled: string[] = [];
  const reasons = r.reasons.filter((x) => onPage(x.quote, pageText)).map((x) => ({ reason: plain(x.reason), quote: plain(x.quote) }));
  const concerns = r.concerns.filter((x) => onPage(x.quote, pageText)).map((x) => ({ concern: plain(x.concern), quote: plain(x.quote) }));
  if (reasons.length < r.reasons.length) overruled.push(`${r.reasons.length - reasons.length} reason(s) dropped: quote not on the page`);
  if (concerns.length < r.concerns.length) overruled.push(`${r.concerns.length - concerns.length} concern(s) dropped: quote not on the page`);
  const review = r.review && onPage(r.review.quote, pageText, 2) && norm(r.review.quote).includes(norm(r.review.rating)) ? { ...r.review, themes: plain(r.review.themes) } : null;
  if (r.review && !review) overruled.push("review dropped: its rating wasn't found on the page");

  let presence: Presence = r.presence;
  if (!targetNamed && presence !== "none") {
    overruled.push(`presence ${presence} -> none: our name check didn't find the business on the page`);
    presence = "none";
  } else if (targetNamed && presence === "none") {
    overruled.push("presence none -> list: our name check found the business on the page");
    presence = "list";
  }
  const downgrade = (from: Presence, ok: boolean, why: string) => {
    if (presence === from && !ok) {
      overruled.push(`presence ${from} -> list: ${why}`);
      presence = "list";
    }
  };
  downgrade("rec", reasons.length > 0, "no reason quoted from the page");
  downgrade("rev", review !== null, "no rating quoted from the page");
  downgrade("mixed", concerns.length > 0, "no concern quoted from the page");

  const columns = {} as Record<Column, CheckedCell>;
  for (const c of COLUMNS) {
    const m = r.columns.find((x) => x.column === c);
    if (!targetNamed) {
      // Not on the page: nothing about the business here (or not expected on this kind of page).
      columns[c] = { status: m?.status === "A" ? "A" : "N", says: m?.status === "A" ? plain(m.says) : "", quote: null, issue: null, action: null };
      continue;
    }
    if (!m) {
      columns[c] = { status: "U", says: "", quote: null, issue: null, action: null };
      overruled.push(`${c}: no reading`);
      continue;
    }
    if ((m.status === "P" || m.status === "L") && !onPage(m.quote, pageText)) {
      overruled.push(`${c}: ${m.status} -> U, quote not on the page`);
      columns[c] = { status: "U", says: "We couldn't confirm this from the page.", quote: null, issue: null, action: null };
      continue;
    }
    columns[c] = { status: m.status, says: plain(m.says), quote: m.status === "P" || m.status === "L" ? plain(m.quote!) : null, issue: m.issue && plain(m.issue), action: m.action && plain(m.action) };
  }
  if (!targetNamed && (reasons.length || concerns.length || review)) overruled.push("reasons, concerns and review dropped: the business isn't on the page");

  return {
    presence,
    detail: plain(r.detail),
    supports: plain(r.supports),
    reasons: targetNamed ? reasons : [],
    concerns: targetNamed ? concerns : [],
    recommendedInstead: r.recommendedInstead.map(plain).filter(Boolean),
    columns,
    review: targetNamed ? review : null,
    overruled,
  };
}
