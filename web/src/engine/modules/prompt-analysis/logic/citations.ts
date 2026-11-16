import type { ClassifiedPage } from "../schemas";
import { pageKeyOf, type PageCategory } from "./sources";

export type { PageCategory } from "./sources";

const PREFIX: Record<PageCategory, string> = { your: "yw", other: "oc", maps: "mp", review: "rv", dir: "dr", ed: "ed", comm: "cm", off: "of", unc: "un" };

/** A distinct cited page as the report lists it: a short key, its page key (as url) and its classification. Answers keep the original URLs. */
export type CitedPage = {
  key: string;
  url: string;
  category: PageCategory;
  site: string;
  title: string | null;
  owner: ClassifiedPage["owner"];
  basis: { method: ClassifiedPage["method"]; reason: string; evidence: string | null; unclassified: ClassifiedPage["unclassified"] };
};

/**
 * Assigns stable report keys (yw, yw2, rv1, …) to distinct pages (by page key) in order of first citation, taking each
 * page's website and source group from the pa_sources classification.
 */
export class PageRegistry {
  private readonly byPage = new Map<string, CitedPage>();
  private readonly counts = new Map<PageCategory, number>();
  constructor(private readonly classified: ReadonlyMap<string, ClassifiedPage>) {}
  /** Report key for a cited URL (registering it on first sight), or null if it isn't a web URL. */
  keyFor(rawUrl: string): string | null {
    const pageKey = pageKeyOf(rawUrl);
    if (!pageKey) return null;
    const existing = this.byPage.get(pageKey);
    if (existing) return existing.key;
    const c = this.classified.get(pageKey);
    const category: PageCategory = c?.category ?? "unc";
    const n = (this.counts.get(category) ?? 0) + 1;
    this.counts.set(category, n);
    const key = category === "your" && n === 1 ? "yw" : PREFIX[category] + n;
    const page: CitedPage = c
      ? { key, url: pageKey, category, site: c.site, title: c.title, owner: c.owner, basis: { method: c.method, reason: c.reason, evidence: c.evidence, unclassified: c.unclassified } }
      : { key, url: pageKey, category, site: pageKey.split("/")[0]!, title: null, owner: "unknown", basis: { method: "none", reason: "Not in the source classification.", evidence: null, unclassified: "insufficient" } };
    this.byPage.set(pageKey, page);
    return key;
  }
  pages(): CitedPage[] {
    return [...this.byPage.values()];
  }
}
