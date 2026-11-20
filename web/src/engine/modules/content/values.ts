import { z } from "zod";

/**
 * Consistent & current (part 4c): the decision facts we can compare across sources, as values. A model reads values
 * off a page (the website, or a cited page); plain code keeps a value only when its quote is on the page and the value
 * is in the quote, and plain code does every comparison (web-presence/logic/consistent.ts).
 * Owner decision (20 Nov 2026): two outcomes only, "Agree" or "Don't agree"; facts no other source mentions are listed
 * as "Not mentioned by other sources".
 */
export const VALUES_VERSION = "2026-11-20";

export const KINDS = ["phone", "address", "number", "money", "price", "yes-no", "list"] as const;
export type Kind = (typeof KINDS)[number];
/** How a fact is compared, and exactly what to read off the page for it. */
export type Comparable = { kind: Kind; measure: string };

/** Per standard (content/standards.ts) and fact: how it's compared. Facts not listed here aren't compared. */
export const COMPARABLE: Record<string, Record<string, Comparable>> = {
  "car-rental": {
    vehicles: { kind: "list", measure: "each vehicle make and model the business rents out" },
    prices: { kind: "price", measure: "the rental price of one vehicle for a unit of time" },
    requirements: { kind: "number", measure: "the minimum age to rent, in years" },
    "deposit-payment": { kind: "money", measure: "the security deposit amount" },
    "delivery-locations": { kind: "address", measure: "the street address of the business's location or pickup point" },
    "booking-contact": { kind: "phone", measure: "phone numbers for booking or contacting the business" },
    chauffeur: { kind: "yes-no", measure: "whether a chauffeur or driver can be hired with a vehicle" },
    cancellation: { kind: "number", measure: "the notice needed to cancel without charge, in hours" },
    "other-services": { kind: "list", measure: "each service offered besides car rental (such as yacht charters or villa rentals)" },
  },
  "boutique-hotel": {
    location: { kind: "address", measure: "the hotel's street address" },
    pets: { kind: "yes-no", measure: "whether pets are allowed" },
    breakfast: { kind: "yes-no", measure: "whether breakfast is included in the room rate" },
  },
};

/** How each kind of value is written in a reply (shared by the instructions that read values). */
export const KIND_HELP = `How to write each kind of value:
- phone: "value" is the phone number as written.
- address: "value" is the street address as written (number and street; city if given).
- number: "amount" is the number; "unit" says what it counts ("years", "hours"); "value" is the words as written.
- money: "amount" is the number without currency signs or commas; "unit" is the currency code (USD); "value" as written.
- price: "item" is the vehicle or product as written; "amount" the price; "unit" is "hour", "day", "week" or "other";
  "value" as written.
- yes-no: "value" is "yes" or "no".
- list: one entry per item; "value" is the item as written (a make and model, or a service).
Leave "amount", "unit" and "item" null when they don't apply. "quote" is words copied exactly from the page (at least
three words) that contain the value.`;

const text = z.string();
/** One value as a model reads it; "ref" names the website page it came from (website reading only). */
export const readValue = z
  .object({ fact: text, ref: text.nullable(), value: text, amount: z.number().nullable(), unit: text.nullable(), item: text.nullable(), quote: text })
  .strict();
export type ReadValue = z.infer<typeof readValue>;
/** A value plain code kept (same shape, cleaned up). */
export const checkedValue = readValue;
export type CheckedValue = z.infer<typeof checkedValue>;

const norm = (s: string) => s.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
const digits = (s: string) => s.replace(/\D/g, "");
const plain = (s: string) => s.replace(/\s+/g, " ").trim();

/** The quote is on the page word for word (letters and digits), with at least three words. */
export function quoteOn(quote: string, pageText: string): boolean {
  const q = norm(quote.replace(/\.{3}|…/g, " "));
  return q.split(" ").filter(Boolean).length >= 3 && ` ${norm(pageText)} `.includes(` ${q} `);
}

/** A phone number's comparable form: its last ten digits (a leading country code 1 is dropped). */
export const phoneKey = (s: string) => {
  const d = digits(s);
  return d.length >= 10 ? d.slice(-10) : null;
};

/** The number in an amount as it appears in text: 1500 matches "1,500", "1500" and "$1.5k" doesn't. */
const amountIn = (amount: number, quote: string) => {
  const q = quote.replace(/(\d),(\d{3})/g, "$1$2");
  return new RegExp(`(?<![\\d.])${String(amount).replace(".", "\\.")}(?:\\.0+)?(?![\\d])`).test(q);
};

/**
 * Plain-code check of one value: the quote must be on the page, and the value must be in the quote (the phone's digits,
 * the amount, the item's words). Returns the value cleaned up, or null with the reason it was dropped.
 */
export function checkValue(v: ReadValue, kind: Kind, pageText: string): { value: CheckedValue | null; dropped: string | null } {
  const why = (r: string) => ({ value: null, dropped: `${v.fact}: "${plain(v.value)}" dropped, ${r}` });
  if (!quoteOn(v.quote, pageText)) return why("quote not on the page");
  const q = v.quote;
  switch (kind) {
    case "phone": {
      const k = phoneKey(v.value);
      if (!k || !digits(q).includes(k)) return why("the number isn't in the quote");
      break;
    }
    case "number":
    case "money":
      if (v.amount === null || !amountIn(v.amount, q)) return why("the amount isn't in the quote");
      break;
    case "price":
      if (v.amount === null || !amountIn(v.amount, q)) return why("the price isn't in the quote");
      if (!v.item || !norm(v.item).split(" ").some((w) => w.length > 2 && norm(q).includes(w))) {
        // The vehicle is often named just before the quoted price; keep it, but only when it's on the page.
        if (!v.item || !norm(pageText).includes(norm(v.item))) return why("the vehicle isn't on the page");
      }
      break;
    case "yes-no":
      if (!["yes", "no"].includes(v.value.trim().toLowerCase())) return why('the value isn\'t "yes" or "no"');
      break;
    case "address":
      if (!/\d/.test(v.value) || !norm(q).includes(norm(v.value).split(" ").slice(0, 2).join(" "))) return why("the address isn't in the quote");
      break;
    case "list":
      if (!norm(v.value).split(" ").some((w) => w.length > 2 && norm(q).includes(w))) return why("the item isn't in the quote");
      break;
  }
  return { value: { ...v, value: plain(v.value), quote: plain(v.quote), item: v.item && plain(v.item), unit: v.unit && v.unit.trim().toLowerCase() }, dropped: null };
}

/** Checks a model's values for a standard's comparable facts; values for other facts are dropped. */
export function checkValues(values: readonly ReadValue[], standardId: string, textOf: (v: ReadValue) => string | null): { values: CheckedValue[]; dropped: string[] } {
  const comparable = COMPARABLE[standardId] ?? {};
  const out: CheckedValue[] = [];
  const dropped: string[] = [];
  for (const v of values) {
    const c = comparable[v.fact];
    const page = textOf(v);
    if (!c) {
      dropped.push(`${v.fact}: not a compared fact`);
      continue;
    }
    if (page === null) {
      dropped.push(`${v.fact}: "${plain(v.value)}" dropped, unknown page ${v.ref ?? ""}`.trim());
      continue;
    }
    const r = checkValue(v, c.kind, page);
    if (r.value) out.push(r.value);
    else dropped.push(r.dropped!);
  }
  return { values: out, dropped };
}

/** The compared facts of a standard, for an instruction's input. */
export function comparableFacts(standard: { id: string; facts: readonly { id: string; name: string; lookFor: string }[] }) {
  const c = COMPARABLE[standard.id] ?? {};
  return standard.facts.filter((f) => c[f.id]).map((f) => ({ id: f.id, name: f.name, kind: c[f.id]!.kind, read: c[f.id]!.measure }));
}
