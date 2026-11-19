import { z } from "zod";
import { OUTSIDE_CATEGORIES } from "./logic/pages";

/** wp_pages: the cited outside pages we checked, how we read each one, and the businesses each names. */
export const citedPages = z
  .object({
    version: z.string(),
    cap: z.number().int().min(1),
    /** Outside pages cited in usable answers (all of them, checked or not). */
    outsidePages: z.number().int().min(0),
    /** The target first, then every other business the prompt analysis names. */
    businesses: z.array(z.object({ key: z.string(), name: z.string(), target: z.boolean() }).strict()),
    pages: z.array(
      z
        .object({
          key: z.string(),
          url: z.string(),
          site: z.string(),
          category: z.enum(OUTSIDE_CATEGORIES),
          title: z.string().nullable(),
          prompts: z.number().int().min(0),
          answers: z.number().int().min(0),
          engines: z.array(z.number().int().min(0).max(2)),
          /** checked: we read the page. unchecked: we couldn't (see reason); never read as the business being absent. */
          state: z.enum(["checked", "unchecked"]),
          reason: z.string().nullable(),
          /** The copy we read: our plain fetch, our browser, or an earlier browser copy from this report. */
          source: z
            .object({ mode: z.enum(["plain", "browser", "earlier_browser"]), snapshotId: z.string(), status: z.number().int().nullable(), finalUrl: z.string().nullable(), fetchedAt: z.string(), words: z.number().int().min(0) })
            .strict()
            .nullable(),
          /** The start of the text we read (checked pages), for review. */
          excerpt: z.string().nullable(),
          /** Every fetch attempt this run (plain, browser), for review. */
          attempts: z.array(z.object({ mode: z.enum(["plain", "browser"]), snapshotId: z.string(), status: z.number().int().nullable(), error: z.string().nullable(), words: z.number().int().min(0) }).strict()),
          names: z.array(z.object({ business: z.string(), excerpt: z.string() }).strict()),
        })
        .strict(),
    ),
  })
  .strict();
export type CitedPages = z.infer<typeof citedPages>;

const cell = z.object({ status: z.enum(["P", "L", "N", "A", "U"]), says: z.string(), quote: z.string().nullable(), issue: z.string().nullable(), action: z.string().nullable() }).strict();

/** wp_assess: the model's reading of each checked page, after the plain-code checks (logic/assess.ts). */
export const assessedPages = z
  .object({
    version: z.string(),
    model: z.string(),
    /** The wp_pages run these readings belong to (the report part uses them only with that run). */
    fromRun: z.string(),
    pages: z.array(
      z
        .object({
          key: z.string(),
          /** Our copy was cut to this many words for the reading (null: the whole copy). */
          cutAt: z.number().int().nullable(),
          reading: z
            .object({
              presence: z.enum(["rec", "rev", "list", "mixed", "none"]),
              detail: z.string(),
              supports: z.string(),
              reasons: z.array(z.object({ reason: z.string(), quote: z.string() }).strict()),
              concerns: z.array(z.object({ concern: z.string(), quote: z.string() }).strict()),
              recommendedInstead: z.array(z.string()),
              columns: z.object({ details: cell, services: cell, fit: cell, reviews: cell, recommendations: cell, locations: cell }).strict(),
              review: z.object({ rating: z.string(), scale: z.number().positive().nullable(), count: z.string().nullable(), recent: z.string().nullable(), themes: z.string(), quote: z.string() }).strict().nullable(),
              overruled: z.array(z.string()),
            })
            .strict()
            .nullable(),
          /** Why there is no reading (the model call failed, or the spending cap was reached). */
          error: z.string().nullable(),
        })
        .strict(),
    ),
  })
  .strict();
export type AssessedPages = z.infer<typeof assessedPages>;
