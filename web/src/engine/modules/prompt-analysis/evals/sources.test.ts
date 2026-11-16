// Cited sources: page and website keys, verified rules, provider evidence, the model-fallback checks, and the pa_sources
// stage end to end with a fake model (cache, spending cap, unclassified states). No real API is called.
import { describe, expect, it } from "vitest";
import { MemoryStore } from "../../../engine.test-support";
import { executeRun, type Providers } from "../../../execute";
import { instructionRef } from "../../../llm";
import { registry } from "../../../index";
import { FakeLlmClient } from "../../../testing/fake-llm";
import type { ClaimedRun, JsonValue, StageInput } from "../../../types";
import { applySiteOwnership, checkModelClassification, citationEvidence, pageKeyOf, ruleGroup, siteKeyOf, type PageEvidence, type SourceGroup } from "../logic/sources";
import type { ClassifiedSources, EngineAnswers, PromptSetSpec } from "../schemas";
import { CLASSIFIER_VERSION } from "../sources-stage";

describe("page and website keys", () => {
  it("drops tracking parameters, fragments, www and trailing slashes; keeps content parameters (sorted)", () => {
    expect(pageKeyOf("https://www.Yelp.com/biz/red-hook/?utm_source=chatgpt.com#reviews")).toBe("yelp.com/biz/red-hook");
    expect(pageKeyOf("https://mphclub.com/miami/?utm_source=openai")).toBe("mphclub.com/miami");
    expect(pageKeyOf("https://example.com/list?page=2&utm_medium=x&id=7&gclid=1")).toBe("example.com/list?id=7&page=2");
    expect(pageKeyOf("http://www.findexotic.com/merchant_detail.htm?uId=mphclub")).toBe("findexotic.com/merchant_detail.htm?uId=mphclub");
    expect(pageKeyOf("https://Example.com/Case/Path")).toBe("example.com/Case/Path");
    expect(pageKeyOf("mailto:a@b.c")).toBeNull();
    expect(pageKeyOf("not a url")).toBeNull();
  });

  it("uses the registrable domain as the website, with shared-hosting overrides", () => {
    expect(siteKeyOf("reviews.birdeye.com/exotic-car-rental-miami")).toBe("birdeye.com");
    expect(siteKeyOf("maps.google.com/x")).toBe("google.com");
    expect(siteKeyOf("come.yachts/miami/prices")).toBe("come.yachts");
    expect(siteKeyOf("someone.github.io/page")).toBe("someone.github.io");
    expect(siteKeyOf("sites.google.com/view/acme-cars/home")).toBe("sites.google.com/view/acme-cars");
    expect(siteKeyOf("dmv.ca.gov/portal/x")).toBe("dmv.ca.gov");
    expect(siteKeyOf("dor.ca.gov/y")).toBe("dor.ca.gov");
  });

  it("keeps similarly named domains separate unless a confirmed alias joins them", () => {
    expect(siteKeyOf("mhp-miami.com/ferrari")).toBe("mhp-miami.com");
    expect(siteKeyOf("mphclub.com/miami")).toBe("mphclub.com");
    const aliases = new Map([["mvpmiamirentals.com", "mvpmiami.com"], ["mvpmiami.com", "mvpmiami.com"]]);
    expect(siteKeyOf("mvpmiamirentals.com/cars", { aliases })).toBe("mvpmiami.com");
    expect(siteKeyOf("book.mvpmiami.com/x", { aliases })).toBe("mvpmiami.com");
    expect(siteKeyOf("mvp-miami.com/x", { aliases })).toBe("mvp-miami.com");
  });

  it("acceptance example: mphclub.com, /miami, /exotic-car-rental and /contacts are one website with four pages", () => {
    const urls = ["https://mphclub.com/", "https://mphclub.com/miami/?utm_source=openai", "https://mphclub.com/exotic-car-rental/", "https://mphclub.com/contacts/?utm_source=openai", "https://www.mphclub.com/miami"];
    const pages = new Set(urls.map((u) => pageKeyOf(u)!));
    expect([...pages]).toEqual(["mphclub.com", "mphclub.com/miami", "mphclub.com/exotic-car-rental", "mphclub.com/contacts"]);
    expect(new Set([...pages].map((p) => siteKeyOf(p)))).toEqual(new Set(["mphclub.com"]));
  });
});

describe("verified rules", () => {
  const rule = (url: string) => {
    const k = pageKeyOf(url)!;
    return ruleGroup(k, siteKeyOf(k))?.group ?? null;
  };
  it("classifies by the specific page on mixed-purpose domains", () => {
    expect(rule("https://www.google.com/maps/place/MVP+Miami")).toBe("maps");
    expect(rule("https://www.google.com/search?q=x")).toBeNull();
    expect(rule("https://www.yelp.com/biz/mph-club-miami")).toBe("review");
    expect(rule("https://www.yelp.com/search?find_desc=exotic")).toBe("dir");
    expect(rule("https://turo.com/us/en/car-rental/united-states/miami-fl")).toBe("dir");
    expect(rule("https://turo.com/blog/best-cars")).toBe("company");
    expect(rule("https://www.tripadvisor.com/Attraction_Review-g34438-d1-Reviews-X.html")).toBe("review");
  });
  it("covers social platforms, government domains and known publishers; leaves other sites to the model", () => {
    expect(rule("https://www.instagram.com/mphclub/")).toBe("comm");
    expect(rule("https://www.reddit.com/r/Miami/comments/1")).toBe("comm");
    expect(rule("https://www.flhsmv.gov/driver-licenses")).toBe("off");
    expect(rule("https://www.timeout.com/miami/things-to-do")).toBe("ed");
    expect(rule("https://mphclub.com/miami")).toBeNull();
    expect(rule("https://carrentallist.com/company/mph-club")).toBeNull();
  });
});

describe("evidence from provider responses", () => {
  it("reads OpenAI url_citation titles and the sentence before the citation", () => {
    const text = "Rentals are popular. mph club has a large fleet in Miami. ([mphclub.com](https://mphclub.com/miami/))";
    const raw = { output: [{ content: [{ type: "output_text", annotations: [{ type: "url_citation", url: "https://mphclub.com/miami/?utm_source=openai", title: "Exotic Car Rental in Miami | mph club", start_index: text.indexOf("(["), end_index: text.length }] }] }] };
    expect(citationEvidence(raw, text)).toEqual([{ url: "https://mphclub.com/miami/?utm_source=openai", title: "Exotic Car Rental in Miami | mph club", excerpt: "mph club has a large fleet in Miami.", from: "answer" }]);
  });
  it("reads Anthropic cited_text and Gemini grounding chunks with their support text", () => {
    const claude = [{ content: [{ type: "text", citations: [{ type: "web_search_result_location", url: "https://www.yelp.com/biz/x", title: "X - Yelp", cited_text: "4.8 stars from 120 reviews" }] }] }];
    expect(citationEvidence(claude, null)).toEqual([{ url: "https://www.yelp.com/biz/x", title: "X - Yelp", excerpt: "4.8 stars from 120 reviews", from: "page" }]);
    const gemini = { candidates: [{ groundingMetadata: { groundingChunks: [{ web: { uri: "https://vertexaisearch.cloud.google.com/grounding-api-redirect/abc", title: "mphclub.com" } }], groundingSupports: [{ segment: { text: "mph club delivers cars." }, groundingChunkIndices: [0] }] } }] };
    expect(citationEvidence(gemini, null)).toEqual([{ url: "https://vertexaisearch.cloud.google.com/grounding-api-redirect/abc", title: "mphclub.com", excerpt: "mph club delivers cars.", from: "answer" }]);
  });
});

describe("a business's own website", () => {
  const v = (pageKey: string, group: SourceGroup, method = "model", unclassified: "insufficient" | "outside" | null = null) => ({ pageKey, site: pageKey.split("/")[0]!, group, method, unclassified, reason: "r", evidence: null });
  it("moves its articles and evidence-poor pages to Company websites when it is mostly company pages", () => {
    const changed = applySiteOwnership([
      v("mphclub.com/miami", "company"),
      v("mphclub.com/contacts", "company"),
      v("mphclub.com/luxury-car-rental-for-weddings-miami", "ed"),
      v("mphclub.com/vehicle-delivery-services", "unc", "model", "insufficient"),
      v("mphclub.com/odd", "unc", "model", "outside"),
    ]);
    expect([...changed.keys()].sort()).toEqual(["mphclub.com/luxury-car-rental-for-weddings-miami", "mphclub.com/vehicle-delivery-services"]);
    expect(changed.get("mphclub.com/luxury-car-rental-for-weddings-miami")).toMatchObject({ group: "company", unclassified: null });
    expect(changed.get("mphclub.com/luxury-car-rental-for-weddings-miami")!.reason).toContain("business's own website");
  });
  it("leaves publishers and rule-based pages alone", () => {
    expect(applySiteOwnership([v("timeout.com/a", "ed"), v("timeout.com/b", "ed"), v("timeout.com/shop", "company")]).size).toBe(0);
    expect(applySiteOwnership([v("turo.com/blog/x", "company", "rule"), v("turo.com/us/miami", "dir", "rule")]).size).toBe(0);
  });
});

describe("model fallback checks", () => {
  const ev: PageEvidence = { pageKey: "carrentallist.com/company/mph-club", site: "carrentallist.com", url: "https://carrentallist.com/company/mph-club", titles: ["mph club - Exotic Car Rental Company Listing"], pageText: [], aiSaid: ["mph club:** Known for one of the largest exotic fleets"], siblings: [] };
  it("accepts a valid group with evidence found in what it was given", () => {
    expect(checkModelClassification({ pageKey: ev.pageKey, group: "dir", reason: "A third-party listing of a rental company.", evidence: "Company Listing" }, ev)).toMatchObject({ group: "dir", unclassified: null, accepted: true });
  });
  it("ignores punctuation and Markdown when checking the quote, but still requires the words", () => {
    expect(checkModelClassification({ pageKey: ev.pageKey, group: "dir", reason: "Listing.", evidence: "mph club: known for one of the largest exotic fleets" }, ev)).toMatchObject({ group: "dir", accepted: true });
    expect(checkModelClassification({ pageKey: ev.pageKey, group: "dir", reason: "Listing.", evidence: "Exotic-Car Rental, Company listing!" }, ev)).toMatchObject({ group: "dir", accepted: true });
    expect(checkModelClassification({ pageKey: ev.pageKey, group: "dir", reason: "Listing.", evidence: "largest fleets in Florida" }, ev)).toMatchObject({ group: "unc", accepted: false });
  });
  it("accepts several quotes joined with ';' when every part is in the evidence (title and page text alike)", () => {
    const page: PageEvidence = { pageKey: "signatureexoticcars.com", site: "signatureexoticcars.com", url: "https://signatureexoticcars.com/", titles: ["Exotic Luxury Car Rental Services in Miami, Florida"], pageText: ["Drivers under the age of 25 years can still rent a vehicle from us but will be subject to an additional fee."], aiSaid: [], siblings: [] };
    const joined = "Exotic Luxury Car Rental Services in Miami; Drivers under the age of 25 years can still rent a vehicle from us";
    expect(checkModelClassification({ pageKey: page.pageKey, group: "company", reason: "Own rental page.", evidence: joined }, page)).toMatchObject({ group: "company", accepted: true });
    // One invented part is enough to reject the verdict.
    expect(checkModelClassification({ pageKey: page.pageKey, group: "company", reason: "Own rental page.", evidence: joined + "; family owned since 1990" }, page)).toMatchObject({ group: "unc", accepted: false });
  });
  it("leaves the page unclassified when the evidence isn't in the page details, or no verdict came back", () => {
    expect(checkModelClassification({ pageKey: ev.pageKey, group: "review", reason: "Reviews.", evidence: "4.9 stars from 300 reviews" }, ev)).toMatchObject({ group: "unc", unclassified: "insufficient", accepted: false });
    expect(checkModelClassification(undefined, ev)).toMatchObject({ group: "unc", unclassified: "insufficient", accepted: false });
    expect(checkModelClassification({ pageKey: ev.pageKey, group: "dir", reason: " ", evidence: "Company Listing" }, ev)).toMatchObject({ group: "unc", accepted: false });
  });
  it("keeps 'outside the taxonomy' and 'not enough evidence' apart inside Other / Unclassified", () => {
    expect(checkModelClassification({ pageKey: ev.pageKey, group: "outside", reason: "A login page.", evidence: "mph-club" }, ev)).toMatchObject({ group: "unc", unclassified: "outside", accepted: true });
    expect(checkModelClassification({ pageKey: ev.pageKey, group: "unc", reason: "Only a URL.", evidence: "unc" }, ev)).toMatchObject({ group: "unc", unclassified: "insufficient", accepted: true });
  });
});

// ---------------------------------------------------------------------------------------------------------------
// pa_sources end to end (fake model)
// ---------------------------------------------------------------------------------------------------------------

const SET: PromptSetSpec = {
  promptSet: { id: "00000000-0000-4000-8000-000000000001", version: 1, approvedAt: "2026-11-13T10:00:00Z" },
  target: { name: "MVP Miami", aliases: [], domains: ["mvpmiami.com"], location: "Miami, FL", category: "Luxury rentals" },
  location: null,
  groups: [{ name: "Baseline", description: "General" }],
  prompts: [
    { id: "P1", group: 0, demand: "d", text: "Best exotic car rental in Miami" },
    { id: "P2", group: 0, demand: "d", text: "Yacht rental Miami" },
  ],
};

function answers(engine: number, list: { promptId: string; citations: string[] }[]): EngineAnswers {
  return {
    engine,
    provider: "fake",
    model: "fake",
    settings: {},
    configured: true,
    answers: list.map((a) => ({ answerId: `e${engine}-${a.promptId}`, promptId: a.promptId, engine, status: "ok", text: "An answer.", error: null, citations: a.citations, searchObserved: true, respondedAt: "2026-11-13T14:05:00Z", searchQueries: [], servedModel: null, requestId: null })),
  };
}

async function runSources(store: MemoryStore, providers: Providers) {
  const def = registry.get("pa_sources")!;
  const run: ClaimedRun = { id: "src-1", reportId: "r1", stage: "pa_sources", version: 1, attempt: 1, maxAttempts: 2, timeoutMs: def.timeoutMs, params: {}, inputRunIds: store.inputs.map((i) => i.runId), instructions: await Promise.all((def.instructions ?? []).map(instructionRef)) };
  const outcome = await executeRun(store, registry, run, undefined, providers);
  return { outcome, out: store.finished?.output as unknown as ClassifiedSources };
}

function inputs(): StageInput[] {
  const i = (runId: string, stage: string, output: unknown): StageInput => ({ runId, stage, output: output as JsonValue, outputHash: null });
  return [
    i("set", "pa_prompt_set", SET),
    i("a0", "pa_answers_chatgpt", answers(0, [{ promptId: "P1", citations: ["https://mphclub.com/miami/?utm_source=openai", "https://mphclub.com/contacts/?utm_source=openai", "https://www.mvpmiami.com/fleet", "https://carrentallist.com/company/mph-club"] }])),
    i("a1", "pa_answers_claude", answers(1, [{ promptId: "P1", citations: ["https://www.yelp.com/biz/mph-club-miami", "javascript:void(0)"] }])),
    i("a2", "pa_answers_gemini", answers(2, [{ promptId: "P1", citations: ["https://mphclub.com/exotic-car-rental/", "https://www.google.com/maps/place/x"] }, { promptId: "P2", citations: ["https://mphclub.com/"] }])),
  ];
}

const VERDICTS = (req: { user: string }) => {
  const pages = (JSON.parse(req.user.slice(req.user.indexOf("{"))) as { pages: { pageKey: string; titles: string[] }[] }).pages;
  return JSON.stringify({
    items: pages.map((p) =>
      p.pageKey === "mphclub.com/exotic-car-rental"
        ? { pageKey: p.pageKey, group: "ed", reason: "Reads like a review of the company.", evidence: "mph club" }
        : p.pageKey.startsWith("mphclub.com")
        ? { pageKey: p.pageKey, group: "company", reason: "The rental company's own page.", evidence: "mph club" }
        : { pageKey: p.pageKey, group: "dir", reason: "A third-party company listing.", evidence: "Company Listing" },
    ),
  });
};

describe("pa_sources stage", () => {
  it("keys pages and websites, applies own domains and rules first, and asks the model only about the rest", async () => {
    const store = new MemoryStore(5, 0, inputs());
    store.rawResponses.set("e0-P1", { output: [{ content: [{ annotations: [
      { type: "url_citation", url: "https://mphclub.com/miami/?utm_source=openai", title: "Exotic Car Rental in Miami | mph club" },
      { type: "url_citation", url: "https://mphclub.com/contacts/?utm_source=openai", title: "Contact mph club" },
      { type: "url_citation", url: "https://carrentallist.com/company/mph-club", title: "mph club - Company Listing" },
    ] }] }] });
    store.rawResponses.set("e2-P1", { candidates: [{ groundingMetadata: { groundingChunks: [{ web: { uri: "https://vertexaisearch.cloud.google.com/r/1", title: "mphclub.com" } }], groundingSupports: [{ segment: { text: "mph club rents exotic cars." }, groundingChunkIndices: [0] }] } }] });
    store.rawResponses.set("e2-P2", { candidates: [{ groundingMetadata: { groundingChunks: [{ web: { uri: "https://vertexaisearch.cloud.google.com/r/2", title: "mphclub.com" } }], groundingSupports: [{ segment: { text: "mph club also lists yachts." }, groundingChunkIndices: [0] }] } }] });
    const llm = new FakeLlmClient((r) => VERDICTS(r));
    const { outcome, out } = await runSources(store, { llm });
    expect(outcome.outcome).toBe("done");

    const by = new Map(out.pages.map((p) => [p.pageKey, p]));
    expect([...by.keys()].sort()).toEqual(["carrentallist.com/company/mph-club", "google.com/maps/place/x", "mphclub.com", "mphclub.com/contacts", "mphclub.com/exotic-car-rental", "mphclub.com/miami", "mvpmiami.com/fleet", "yelp.com/biz/mph-club-miami"]);
    // Acceptance example: four mphclub.com pages, one website.
    expect(out.pages.filter((p) => p.site === "mphclub.com")).toHaveLength(4);
    expect(by.get("mvpmiami.com/fleet")).toMatchObject({ site: "mvpmiami.com", group: "company", owner: "target", category: "your", method: "alias" });
    expect(by.get("yelp.com/biz/mph-club-miami")).toMatchObject({ group: "review", category: "review", method: "rule" });
    expect(by.get("google.com/maps/place/x")).toMatchObject({ group: "maps", method: "rule" });
    expect(by.get("mphclub.com/miami")).toMatchObject({ group: "company", owner: "business", category: "other", method: "model", title: "Exotic Car Rental in Miami | mph club" });
    expect(by.get("mphclub.com")).toMatchObject({ category: "other", method: "model" }); // evidence from Gemini's support text
    // The model called this page editorial, but mphclub.com is the business's own website: it stays a company page.
    expect(by.get("mphclub.com/exotic-car-rental")).toMatchObject({ group: "company", category: "other" });
    expect(by.get("mphclub.com/exotic-car-rental")!.reason).toContain("business's own website");
    expect(by.get("carrentallist.com/company/mph-club")).toMatchObject({ group: "dir", owner: "unknown", category: "dir", method: "model" });
    expect(out.unreadable).toEqual({ "e1-P1": 1 });
    // One batch, only the five pages no rule covers.
    expect(llm.requests).toHaveLength(1);
    const sent = JSON.parse(llm.requests[0]!.user.slice(llm.requests[0]!.user.indexOf("{"))).pages as { pageKey: string; aiSaid: string[]; pageText: string[]; otherPagesOnWebsite: { url: string }[] }[];
    expect(sent).toHaveLength(5);
    // Gemini's support text is the AI's sentence, labelled as such; other mphclub.com pages are listed as siblings.
    const home = sent.find((x) => x.pageKey === "mphclub.com")!;
    expect(home.aiSaid).toContain("mph club also lists yachts.");
    expect(home.pageText).toEqual([]);
    expect(home.otherPagesOnWebsite.map((o) => o.url)).toContain("mphclub.com/miami");
    expect(store.classifications.map((c) => c.classifierVersion)).toEqual(Array(5).fill(CLASSIFIER_VERSION));

    // A rerun uses the cache: no model call.
    const again = new MemoryStore(5, 0, inputs());
    again.classifications = store.classifications;
    const llm2 = new FakeLlmClient(() => {
      throw new Error("should not be called");
    });
    const second = await runSources(again, { llm: llm2 });
    expect(llm2.requests).toHaveLength(0);
    expect(second.out.pages.find((p) => p.pageKey === "mphclub.com/miami")).toMatchObject({ category: "other", method: "cache" });
  });

  it("leaves pages unclassified when the model's evidence isn't in the page details, or no model is available", async () => {
    const store = new MemoryStore(5, 0, inputs());
    const llm = new FakeLlmClient((r) => {
      const pages = (JSON.parse(r.user.slice(r.user.indexOf("{"))) as { pages: { pageKey: string }[] }).pages;
      return JSON.stringify({ items: pages.map((p) => ({ pageKey: p.pageKey, group: "ed", reason: "An article.", evidence: "Top 10 exotic rentals" })) });
    });
    const { out } = await runSources(store, { llm });
    const mph = out.pages.find((p) => p.pageKey === "mphclub.com/miami")!;
    expect(mph).toMatchObject({ group: "unc", category: "unc", unclassified: "insufficient", method: "model" });
    expect(store.classifications).toHaveLength(0); // rejected verdicts aren't cached

    const none = await runSources(new MemoryStore(5, 0, inputs()), {});
    expect(none.outcome.outcome).toBe("partial");
    expect(none.out.pages.find((p) => p.pageKey === "mphclub.com/miami")).toMatchObject({ group: "unc", method: "none", unclassified: "insufficient" });
    expect(none.out.pages.find((p) => p.pageKey === "yelp.com/biz/mph-club-miami")).toMatchObject({ group: "review", method: "rule" });
  });
});
