// Website stages 5 (crawl and select): page reading, discovery, crawler rules and the three stages with a fake site.
// No network: the fetcher is a fake that serves fixed pages.
import { describe, expect, it } from "vitest";
import { MemoryStore } from "../../../engine.test-support";
import { executeRun, type Providers, type WebFetcher } from "../../../execute";
import { registry } from "../../../index";
import type { ClaimedRun, FetchedResource, JsonValue, StageInput } from "../../../types";
import { extractLinks, extractPage, parseSitemap } from "../logic/extract";
import { excluded, pageKind, suggestPages, type Candidate } from "../logic/pages";
import { permission } from "../logic/robots";
import type { Discovery, Snapshots } from "../schemas";

const HOME = `<!doctype html><html><head><title>MVP Miami | Exotic Cars, Villas &amp; Yachts</title>
<meta name="description" content="Luxury rentals in Miami."><link rel="canonical" href="https://mvpmiami.com/">
<script type="application/ld+json">{"@context":"https://schema.org","@type":"AutoRental","name":"MVP Miami","telephone":"+1 305 555 0100"}</script>
<script type="application/ld+json">{ not json</script></head>
<body><header><nav><a href="/cars">Exotic Cars</a><a href="/villas">Villas</a><a href="/yachts">Yachts</a><a href="/faq">FAQ</a><a href="/contact">Contact</a></nav></header>
<main><h1>Miami's luxury rentals</h1><p>Rent supercars, mansions and yachts from one team.</p><h2>Why MVP</h2><p>Free delivery in Miami-Dade.</p>
<a href="/terms">Rental terms</a><a href="/cart">Cart</a><a href="mailto:hi@mvpmiami.com">Email</a><a href="https://instagram.com/mvp">IG</a></main>
<footer><a href="/privacy">Privacy</a></footer><script>window.x=1</script></body></html>`;

describe("reading a page", () => {
  it("extracts title, description, canonical, headings, main text and structured data", () => {
    const p = extractPage(HOME);
    expect(p.title).toBe("MVP Miami | Exotic Cars, Villas & Yachts");
    expect(p.description).toBe("Luxury rentals in Miami.");
    expect(p.canonical).toBe("https://mvpmiami.com/");
    expect(p.headings).toEqual([{ level: 1, text: "Miami's luxury rentals" }, { level: 2, text: "Why MVP" }]);
    expect(p.text).toContain("Rent supercars, mansions and yachts from one team.");
    expect(p.text).not.toContain("Exotic Cars"); // navigation is left out of the main text
    expect(p.text).not.toContain("window.x");
    expect(p.jsonLd.map((j) => j.types)).toEqual([["AutoRental"], []]);
    expect(p.jsonLd[1]!.error).toBeTruthy();
  });

  it("lists links with whether they are navigation, skipping mailto and fragments", () => {
    const links = extractLinks(HOME, "https://mvpmiami.com/");
    expect(links.find((l) => l.url === "https://mvpmiami.com/cars")).toMatchObject({ inNav: true, text: "Exotic Cars" });
    expect(links.find((l) => l.url === "https://mvpmiami.com/terms")).toMatchObject({ inNav: false });
    expect(links.find((l) => l.url === "https://mvpmiami.com/privacy")).toMatchObject({ inNav: true }); // footer counts
    expect(links.some((l) => l.url.startsWith("mailto"))).toBe(false);
  });

  it("reads sitemaps and sitemap indexes", () => {
    expect(parseSitemap(`<urlset><url><loc>https://a.com/x</loc></url><url><loc><![CDATA[https://a.com/y?a=1&amp;b=2]]></loc></url></urlset>`)).toEqual({ kind: "urlset", locs: ["https://a.com/x", "https://a.com/y?a=1&b=2"] });
    expect(parseSitemap(`<sitemapindex><sitemap><loc>https://a.com/s1.xml</loc></sitemap></sitemapindex>`).kind).toBe("index");
  });
});

describe("choosing pages", () => {
  it("names page kinds from URLs and skips carts, accounts, search and files", () => {
    expect(pageKind("https://a.com/")).toBe("home");
    expect(pageKind("https://a.com/contact-us")).toBe("contact");
    expect(pageKind("https://a.com/faqs/")).toBe("faq");
    expect(pageKind("https://a.com/rental-agreement")).toBe("policy");
    expect(pageKind("https://a.com/locations/fort-lauderdale")).toBe("location");
    expect(pageKind("https://a.com/lamborghini-urus")).toBe("other");
    for (const u of ["https://a.com/cart", "https://a.com/my-account/orders", "https://a.com/?s=car", "https://a.com/brochure.pdf", "https://a.com/blog/page/2"]) expect(excluded(u), u).toBe(true);
    expect(excluded("https://a.com/cars")).toBe(false);
  });

  it("suggests home, cited pages, decision pages and one page per service, within the cap", () => {
    const c = (url: string, sources: Candidate["sources"], linkText: string | null = null): Candidate => ({ url, kind: pageKind(url), sources, linkText });
    const candidates = [
      c("https://mvpmiami.com/", ["home"]),
      c("https://mvpmiami.com/cars", ["nav"], "Exotic Cars"),
      c("https://mvpmiami.com/villas", ["nav"], "Villas"),
      c("https://mvpmiami.com/yachts", ["nav"], "Yachts"),
      c("https://mvpmiami.com/faq", ["nav"]),
      c("https://mvpmiami.com/contact", ["nav"]),
      c("https://mvpmiami.com/privacy", ["nav"]),
      c("https://mvpmiami.com/terms", ["link"]),
      c("https://mvpmiami.com/rentals", ["cited", "sitemap"]),
      c("https://mvpmiami.com/blog/best-cars", ["sitemap"]),
    ];
    const s = suggestPages(candidates, { services: ["Exotic cars", "Villas", "Yachts"], locations: [], cap: 12 });
    expect(s.map((x) => [x.url.replace("https://mvpmiami.com", ""), x.reason])).toEqual([
      ["/", "Home page"],
      ["/rentals", "Cited by an AI in the prompt analysis"],
      ["/contact", "Contact page"],
      ["/faq", "FAQ page"],
      ["/cars", "Service: Exotic cars"],
      ["/villas", "Service: Villas"],
      ["/yachts", "Service: Yachts"],
      ["/terms", "Policies or rental terms"],
    ]);
    expect(suggestPages(candidates, { services: [], locations: [], cap: 3 })).toHaveLength(3);
  });
});

describe("published crawler rules", () => {
  const robots = { url: "https://a.com/robots.txt", status: 200, error: null, body: "User-agent: GPTBot\nDisallow: /\n\nUser-agent: *\nDisallow: /private/\n" };
  it("reads per-crawler rules with the matching line", () => {
    expect(permission(robots, "https://a.com/cars", "GPTBot")).toMatchObject({ verdict: "blocked", line: 2 });
    expect(permission(robots, "https://a.com/cars", "OAI-SearchBot")).toMatchObject({ verdict: "allowed" });
    expect(permission(robots, "https://a.com/private/x", "Claude-SearchBot")).toMatchObject({ verdict: "blocked", line: 5 });
  });
  it("treats a missing robots.txt as no rules, and a refused or failed one as unconfirmed, never as a block", () => {
    expect(permission({ ...robots, status: 404, body: null }, "https://a.com/x", "GPTBot").verdict).toBe("allowed");
    expect(permission({ ...robots, status: 403, body: null }, "https://a.com/x", "GPTBot").verdict).toBe("unconfirmed");
    expect(permission({ ...robots, status: 503, body: null }, "https://a.com/x", "GPTBot").verdict).toBe("unconfirmed");
    expect(permission({ ...robots, status: null, body: null, error: "Timed out" }, "https://a.com/x", "GPTBot").verdict).toBe("unconfirmed");
  });
});

// ---------------------------------------------------------------------------------------------------------------
// Stages with a fake website
// ---------------------------------------------------------------------------------------------------------------

const SITE: Record<string, { status: number; body: string; type: string } | undefined> = {
  "https://mvpmiami.com/robots.txt": { status: 200, type: "text/plain", body: "User-agent: GPTBot\nDisallow: /\nSitemap: https://mvpmiami.com/sitemap.xml\n" },
  "https://mvpmiami.com/": { status: 200, type: "text/html", body: HOME },
  "https://mvpmiami.com/sitemap.xml": { status: 200, type: "application/xml", body: "<urlset><url><loc>https://mvpmiami.com/rentals</loc></url><url><loc>https://mvpmiami.com/cars</loc></url></urlset>" },
  "https://mvpmiami.com/cars": { status: 200, type: "text/html", body: "<html><head><title>Cars</title></head><body><main><h1>Our fleet</h1><p>Vehicles Found:</p></main></body></html>" },
  "https://mvpmiami.com/faq": { status: 200, type: "text/html", body: "<html><head><title>FAQ</title></head><body><main><p>Free delivery in Miami-Dade.</p></main></body></html>" },
};

const fakeWeb: WebFetcher = {
  async fetch(url) {
    const hit = SITE[url];
    const base: FetchedResource = { requestedUrl: url, finalUrl: url, status: hit?.status ?? 404, contentType: hit?.type ?? "text/html", body: hit?.body ?? null, truncated: false, redirects: [], error: hit ? null : "HTTP 404", durationMs: 1, userAgent: "test" };
    return base;
  },
};

async function run(stage: string, inputs: StageInput[], params: Record<string, JsonValue>, providers: Providers, store = new MemoryStore(5, 0, inputs)) {
  const def = registry.get(stage)!;
  const claimed: ClaimedRun = { id: `${stage}-1`, reportId: "r1", stage, version: 1, attempt: 1, maxAttempts: def.maxAttempts, timeoutMs: def.timeoutMs, params: def.parseParams(params), inputRunIds: inputs.map((i) => i.runId), instructions: [] };
  const outcome = await executeRun(store, registry, claimed, undefined, providers);
  return { outcome, store, input: { runId: claimed.id, stage, output: store.finished?.output ?? null, outputHash: null } as StageInput };
}

describe("website stages (fake site)", () => {
  it("discovers pages, then snapshots the approved ones with crawler rules", async () => {
    const providers: Providers = { web: fakeWeb };
    const disc = await run("ws_discover", [], { website: "https://mvpmiami.com/", domains: ["mvpmiami.com"], services: ["Exotic cars", "Yachts"], cited: [] }, providers);
    expect(disc.outcome.outcome).toBe("done");
    const d = disc.input.output as unknown as Discovery;
    expect(d.robots.status).toBe(200);
    expect(d.sitemaps).toEqual([{ url: "https://mvpmiami.com/sitemap.xml", status: 200, error: null, kind: "urlset", urls: 2 }]);
    expect(d.candidates.find((c) => c.url === "https://mvpmiami.com/cars")!.sources.sort()).toEqual(["nav", "sitemap"]);
    expect(d.candidates.some((c) => c.url.includes("instagram") || c.url.endsWith("/cart"))).toBe(false);
    expect(d.suggested.map((s) => s.url)).toEqual(["https://mvpmiami.com/", "https://mvpmiami.com/contact", "https://mvpmiami.com/faq", "https://mvpmiami.com/cars", "https://mvpmiami.com/yachts", "https://mvpmiami.com/terms", "https://mvpmiami.com/villas", "https://mvpmiami.com/rentals"].slice(0, d.suggested.length));

    const setParams = { pageSet: { id: "00000000-0000-4000-8000-000000000009", version: 1, approvedAt: "2026-11-17T10:00:00Z" }, website: "https://mvpmiami.com/", pages: [{ url: "https://mvpmiami.com/cars", kind: "other", reason: "Service: Exotic cars" }, { url: "https://mvpmiami.com/faq", kind: "faq", reason: "FAQ page" }, { url: "https://mvpmiami.com/gone", kind: "other", reason: "Added by admin" }] };
    const set = await run("ws_page_set", [], setParams as unknown as Record<string, JsonValue>, providers);
    const snap = await run("ws_snapshot", [set.input, disc.input], {}, providers);
    expect(snap.outcome.outcome).toBe("partial"); // one page is a 404
    const s = snap.input.output as unknown as Snapshots;
    const cars = s.pages[0]!;
    expect(cars).toMatchObject({ title: "Cars", status: 200, wordCount: 4, headings: [{ level: 1, text: "Our fleet" }] });
    expect(cars.permissions["GPTBot"]!.verdict).toBe("blocked");
    expect(cars.permissions["OAI-SearchBot"]!.verdict).toBe("allowed");
    expect(s.pages[2]).toMatchObject({ status: 404, error: "HTTP 404", title: null });
    // Every fetch is stored as evidence, failures included, with the body when there is one.
    expect(snap.store.snapshots.map((x) => [x.url, x.fetchMode, x.httpStatus, x.html !== null]).sort()).toEqual([
      ["https://mvpmiami.com/cars", "raw", 200, true],
      ["https://mvpmiami.com/faq", "raw", 200, true],
      ["https://mvpmiami.com/gone", "raw", 404, false],
    ]);
  });

  it("fails clearly when the home page can't be fetched, and when no fetcher is configured", async () => {
    const down = await run("ws_discover", [], { website: "https://down.example/" }, { web: fakeWeb });
    expect(down.outcome.outcome).toBe("failed");
    expect(down.store.finished?.error).toMatch(/home page couldn't be fetched/);
    const none = await run("ws_discover", [], { website: "https://mvpmiami.com/" }, {});
    expect(none.store.finished?.error).toMatch(/No web fetcher/);
  });
});
