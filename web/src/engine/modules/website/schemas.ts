import { z } from "zod";
import { PAGE_KINDS } from "./logic/pages";

const url = z.string().url();
const pageKind = z.enum(PAGE_KINDS);

/** ws_discover params: the business's website and what to look for. */
export const discoverParams = z
  .object({
    website: url,
    domains: z.array(z.string()).default([]),
    services: z.array(z.string()).default([]),
    locations: z.array(z.string()).default([]),
    /** Own-site URLs an AI cited in the prompt analysis (suggested first). */
    cited: z.array(url).default([]),
    cap: z.number().int().min(1).max(20).default(12),
  })
  .strict();
export type DiscoverParams = z.infer<typeof discoverParams>;

export const robotsFile = z
  .object({ url: z.string(), status: z.number().int().nullable(), body: z.string().nullable(), error: z.string().nullable(), fetchedAt: z.string() })
  .strict();

export const candidate = z
  .object({
    url: z.string(),
    kind: pageKind,
    sources: z.array(z.enum(["home", "nav", "link", "sitemap", "cited"])),
    linkText: z.string().nullable(),
  })
  .strict();

export const discovery = z
  .object({
    website: z.string(),
    siteDomains: z.array(z.string()),
    homepage: z.object({ url: z.string(), finalUrl: z.string().nullable(), status: z.number().int().nullable(), error: z.string().nullable(), title: z.string().nullable() }).strict(),
    robots: robotsFile,
    sitemaps: z.array(z.object({ url: z.string(), status: z.number().int().nullable(), error: z.string().nullable(), kind: z.string(), urls: z.number().int() }).strict()),
    /** Pages found (not the site's true total: discovery is bounded). */
    candidates: z.array(candidate),
    suggested: z.array(z.object({ url: z.string(), kind: pageKind, reason: z.string() }).strict()),
    cap: z.number().int(),
    limits: z.object({ sitemapFilesRead: z.number().int(), candidatesTruncated: z.boolean() }).strict(),
  })
  .strict();
export type Discovery = z.infer<typeof discovery>;

/** ws_page_set: the approved, frozen list of pages to check (params and output are the same). */
export const pageSetSpec = z
  .object({
    pageSet: z.object({ id: z.string().uuid(), version: z.number().int().positive(), approvedAt: z.string() }).strict(),
    website: z.string(),
    pages: z.array(z.object({ url, kind: pageKind, reason: z.string() }).strict()).min(1).max(20),
  })
  .strict();
export type PageSetSpec = z.infer<typeof pageSetSpec>;

const permission = z.object({ verdict: z.enum(["allowed", "blocked", "unconfirmed"]), line: z.number().int().nullable(), reason: z.string() }).strict();

/** ws_snapshot: our raw fetch of every approved page (evidence, not an AI's view), with published crawler rules. */
export const snapshots = z
  .object({
    robots: z.object({ url: z.string(), status: z.number().int().nullable(), registryVersion: z.string() }).strict(),
    pages: z.array(
      z
        .object({
          url: z.string(),
          kind: pageKind,
          reason: z.string(),
          snapshotId: z.string().nullable(),
          finalUrl: z.string().nullable(),
          status: z.number().int().nullable(),
          error: z.string().nullable(),
          truncated: z.boolean(),
          title: z.string().nullable(),
          description: z.string().nullable(),
          canonical: z.string().nullable(),
          metaRobots: z.string().nullable(),
          headings: z.array(z.object({ level: z.number().int(), text: z.string() }).strict()),
          wordCount: z.number().int(),
          textExcerpt: z.string(),
          jsonLdTypes: z.array(z.string()),
          jsonLdErrors: z.number().int(),
          microdataTypes: z.array(z.string()),
          /** Published robots.txt permission per crawler token for this page. */
          permissions: z.record(z.string(), permission),
        })
        .strict(),
    ),
  })
  .strict();
export type Snapshots = z.infer<typeof snapshots>;
