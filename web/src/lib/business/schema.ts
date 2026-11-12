import { z } from "zod";

/** Splits a textarea/comma list into trimmed, non-empty, de-duplicated (case-insensitive) items. */
export function splitList(raw: unknown): string[] {
  if (typeof raw !== "string") return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of raw.split(/[\n,;]/)) {
    const item = part.trim().replace(/\s+/g, " ");
    if (!item) continue;
    const key = item.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

/** Accepts "example.com" or "https://example.com/path"; returns a normalized https?:// URL or null for blank input. */
export function normalizeWebsite(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    throw new Error("Enter a valid website address, e.g. example.com");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("Website must use http or https");
  if (!url.hostname.includes(".")) throw new Error("Enter a valid website address, e.g. example.com");
  url.hash = "";
  return url.toString();
}

const HOSTNAME = /^(?=.{1,253}$)(?!-)[a-z0-9-]{1,63}(?<!-)(\.(?!-)[a-z0-9-]{1,63}(?<!-))+$/;

/** Accepts bare domains or URLs; returns lower-cased hostnames without "www.". */
export function normalizeDomain(raw: string): string {
  let host = raw.trim().toLowerCase();
  host = host.replace(/^[a-z][a-z0-9+.-]*:\/\//, "").split(/[/?#]/)[0] ?? "";
  host = host.replace(/^www\./, "").replace(/\.$/, "");
  if (!HOSTNAME.test(host)) throw new Error(`"${raw.trim()}" is not a valid domain`);
  return host;
}

export function hostnameOf(website: string | null): string | null {
  if (!website) return null;
  try {
    return normalizeDomain(new URL(website).hostname);
  } catch {
    return null;
  }
}

const requiredText = (label: string, max = 200) =>
  z
    .string({ error: `${label} is required` })
    .transform((s) => s.trim().replace(/\s+/g, " "))
    .pipe(z.string().min(1, `${label} is required`).max(max, `${label} must be at most ${max} characters`));

const optionalText = (max = 300) =>
  z
    .string()
    .optional()
    .transform((s) => (s ?? "").trim().replace(/\s+/g, " "))
    .pipe(z.string().max(max, `Must be at most ${max} characters`))
    .transform((s) => (s.length ? s : null));

const list = (label: string, maxItems = 50, maxLen = 120) =>
  z
    .string()
    .optional()
    .transform(splitList)
    .pipe(
      z
        .array(z.string().max(maxLen, `Each ${label} must be at most ${maxLen} characters`))
        .max(maxItems, `At most ${maxItems} ${label}s`),
    );

/**
 * Business form input (brief §3.1). Raw FormData strings in, database-ready values out.
 * The Google Places identity check (place_id) is Milestone 2 and is not part of this form.
 */
export const businessInput = z
  .object({
    name: requiredText("Business name"),
    website: z
      .string()
      .optional()
      .transform((s, ctx) => {
        try {
          return normalizeWebsite(s ?? "");
        } catch (e) {
          ctx.addIssue({ code: "custom", message: (e as Error).message });
          return z.NEVER;
        }
      }),
    category: requiredText("Category"),
    location: requiredText("Location (city)"),
    service_area: optionalText(),
    services: list("service"),
    aliases: list("other name"),
    domains: list("domain", 20, 253).transform((items, ctx) => {
      const out: string[] = [];
      for (const d of items) {
        try {
          const host = normalizeDomain(d);
          if (!out.includes(host)) out.push(host);
        } catch (e) {
          ctx.addIssue({ code: "custom", message: (e as Error).message });
        }
      }
      return out;
    }),
    customer_types: list("customer type"),
  })
  .transform((b) => {
    // The website's own domain is always one of the business's domains.
    const own = hostnameOf(b.website);
    const domains = own && !b.domains.includes(own) ? [own, ...b.domains] : b.domains;
    return { ...b, domains };
  });

export type BusinessInput = z.output<typeof businessInput>;

export type FieldErrors = Partial<Record<keyof BusinessInput | "form", string>>;

export function formDataToObject(formData: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const key of ["name", "website", "category", "location", "service_area", "services", "aliases", "domains", "customer_types"]) {
    const v = formData.get(key);
    if (typeof v === "string") out[key] = v;
  }
  return out;
}

export function fieldErrors(error: z.ZodError): FieldErrors {
  const out: FieldErrors = {};
  for (const issue of error.issues) {
    const key = (issue.path[0] as keyof BusinessInput | undefined) ?? "form";
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}
