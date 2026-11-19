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
