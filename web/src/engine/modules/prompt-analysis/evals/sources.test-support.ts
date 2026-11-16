import { bareDomains, categoryOf, pageKeyOf, ruleGroup, siteKeyOf } from "../logic/sources";
import type { ClassifiedPage } from "../schemas";

/** What pa_sources produces for these URLs without the model: own domains, then verified rules, else unclassified. */
export function classifyByRules(urls: readonly string[], ownDomains: readonly string[]): Map<string, ClassifiedPage> {
  const own = bareDomains(ownDomains);
  const ownSite = own.length ? siteKeyOf(own[0]!) : null;
  const aliases = new Map(own.map((d) => [d, ownSite!] as const));
  const out = new Map<string, ClassifiedPage>();
  for (const url of urls) {
    const pageKey = pageKeyOf(url);
    if (!pageKey || out.has(pageKey)) continue;
    const site = siteKeyOf(pageKey, { aliases });
    const isOwn = site === ownSite;
    const rule = isOwn ? null : ruleGroup(pageKey, site);
    const group = isOwn ? "company" : (rule?.group ?? "unc");
    const owner = isOwn ? "target" : group === "company" ? "business" : "unknown";
    out.set(pageKey, {
      pageKey,
      site,
      url,
      title: null,
      group,
      owner,
      category: categoryOf(group, owner),
      method: isOwn ? "alias" : rule ? "rule" : "none",
      unclassified: group === "unc" ? "insufficient" : null,
      reason: isOwn ? "own" : (rule?.rule ?? "no rule"),
      evidence: null,
    });
  }
  return out;
}
