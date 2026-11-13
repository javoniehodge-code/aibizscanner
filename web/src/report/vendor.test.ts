import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const design = path.resolve(__dirname, "../../../design/reports");
const support = fs.readFileSync(path.join(design, "support.js"), "utf8");

describe("vendored report runtime", () => {
  it.each([
    ["react.production.min.js", "REACT_SRI"],
    ["react-dom.production.min.js", "REACT_DOM_SRI"],
    ["babel.min.js", "BABEL_SRI"],
  ])("%s matches the SRI hash pinned in support.js (%s)", (file, constant) => {
    const pinned = new RegExp(`var ${constant} = "(sha384-[^"]+)"`).exec(support)?.[1];
    expect(pinned).toBeTruthy();
    const actual = "sha384-" + createHash("sha384").update(fs.readFileSync(path.join(design, "vendor", file))).digest("base64");
    expect(actual).toBe(pinned);
  });
});
