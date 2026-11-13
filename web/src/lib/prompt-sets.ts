import { z } from "zod";
import { FIXTURES } from "@/report/generated/fixtures";

/**
 * The prompt-set form: groups and questions edited as plain text, one per line, so a whole set can be pasted in.
 *   Groups:     Name | description
 *   Questions:  group number | demand | question         (group numbers start at 1; ids P1, P2, … follow line order)
 */

export type PromptGroup = { name: string; description: string };
export type Prompt = { id: string; group: number; demand: string; text: string };
export type CustomerLocation = { city: string; region: string; country: string; timezone: string };
export type PromptSetDraft = { groups: PromptGroup[]; prompts: Prompt[]; location: CustomerLocation | null };

export const MAX_PROMPTS = 30;

const cells = (line: string) => line.split("|").map((c) => c.trim());

export function formatGroups(groups: readonly PromptGroup[]): string {
  return groups.map((g) => `${g.name} | ${g.description}`).join("\n");
}

export function formatPrompts(prompts: readonly Prompt[]): string {
  return prompts.map((p) => `${p.group + 1} | ${p.demand} | ${p.text}`).join("\n");
}

export type ParseResult = { ok: true; value: PromptSetDraft } | { ok: false; errors: string[] };

export function parsePromptSetForm(form: { groups: string; prompts: string; city: string; region: string; country: string; timezone: string }): ParseResult {
  const errors: string[] = [];
  const lines = (s: string) => s.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

  const groups = lines(form.groups).map((line, i): PromptGroup => {
    const [name = "", ...rest] = cells(line);
    const description = rest.join(" | ");
    if (!name || !description) errors.push(`Group line ${i + 1}: write "Name | description".`);
    return { name, description };
  });
  if (!groups.length) errors.push("Add at least one group.");

  const prompts = lines(form.prompts).map((line, i): Prompt => {
    const [g = "", demand = "", ...rest] = cells(line);
    const text = rest.join(" | ");
    const group = Number(g) - 1;
    if (!Number.isInteger(group) || group < 0 || group >= groups.length) errors.push(`Question line ${i + 1}: group must be a number from 1 to ${groups.length}.`);
    if (!demand || !text) errors.push(`Question line ${i + 1}: write "group | demand | question".`);
    return { id: `P${i + 1}`, group, demand, text };
  });
  if (!prompts.length) errors.push("Add at least one question.");
  if (prompts.length > MAX_PROMPTS) errors.push(`At most ${MAX_PROMPTS} questions per set.`);
  const seen = new Set<string>();
  prompts.forEach((p, i) => {
    const k = p.text.toLowerCase();
    if (p.text && seen.has(k)) errors.push(`Question line ${i + 1} repeats an earlier question.`);
    seen.add(k);
  });

  const loc = { city: form.city.trim(), region: form.region.trim(), country: form.country.trim().toUpperCase(), timezone: form.timezone.trim() };
  let location: CustomerLocation | null = null;
  if (Object.values(loc).some(Boolean)) {
    if (!loc.city || !loc.region) errors.push("Customer location: give the city and region, or leave all location fields empty.");
    if (!/^[A-Z]{2}$/.test(loc.country)) errors.push("Customer location: country must be a two-letter code, e.g. US.");
    if (!isTimeZone(loc.timezone)) errors.push("Customer location: time zone must be an IANA name, e.g. America/New_York.");
    location = loc;
  }
  return errors.length ? { ok: false, errors } : { ok: true, value: { groups, prompts, location } };
}

function isTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return tz.includes("/");
  } catch {
    return false;
  }
}

/** Stored prompt set columns (prompt_set.groups / prompts / customer_location). */
export const storedPromptSet = z.object({
  groups: z.array(z.object({ name: z.string(), description: z.string() })),
  prompts: z.array(z.object({ id: z.string(), group: z.number(), demand: z.string(), text: z.string() })),
  customer_location: z.object({ city: z.string(), region: z.string(), country: z.string(), timezone: z.string() }).nullable(),
});

/**
 * Starting point when a report has no prompt set yet: the 12 questions of the MVP Miami example report
 * (fixtures/mvp-miami.json), to be edited for the business.
 */
export function examplePromptSet(): PromptSetDraft {
  const doc = FIXTURES["mvp-miami"] as {
    promptAnalysis: {
      groups: { v: PromptGroup }[];
      questions: { question: { v: Prompt } }[];
    };
  };
  return {
    groups: doc.promptAnalysis.groups.map((g) => g.v),
    prompts: doc.promptAnalysis.questions.map((q) => q.question.v),
    location: { city: "Miami", region: "Florida", country: "US", timezone: "America/New_York" },
  };
}
