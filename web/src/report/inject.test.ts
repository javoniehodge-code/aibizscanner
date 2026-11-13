import { describe, expect, it } from "vitest";
import { injectReport } from "./inject";

const template = '<!DOCTYPE html>\n<html>\n<head>\n<script src="./support.js"></script>\n</head><body></body></html>';

describe("injectReport", () => {
  it("sets window.__REPORT__ and the base before any other script", () => {
    const html = injectReport(template, { a: 1 }, "/report-template/");
    const base = html.indexOf('<base href="/report-template/">');
    const data = html.indexOf("window.__REPORT__ = {\"a\":1};");
    expect(base).toBeGreaterThan(0);
    expect(data).toBeGreaterThan(base);
    expect(data).toBeLessThan(html.indexOf("./support.js"));
  });

  it("escapes text that could end the script element or inject markup", () => {
    const evil = { t: "</script><script>alert(1)</script>", u: "a\u2028b & <!--" };
    const html = injectReport(template, evil, "/x/");
    expect(html.match(/<\/script>/g)).toHaveLength(2); // the injected one and support.js's
    const json = /window\.__REPORT__ = (.*);<\/script>/.exec(html)?.[1] ?? "";
    expect(JSON.parse(json)).toEqual(evil);
  });

  it("refuses a template without <head>", () => {
    expect(() => injectReport("<html></html>", {}, "/")).toThrow(/no <head>/);
  });
});
