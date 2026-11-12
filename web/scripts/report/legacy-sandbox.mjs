// Runs a legacy `.dc.html` report script (the pre-JSON Claude Design exports) in a Node sandbox so its data can be
// extracted mechanically instead of being copied by hand. Used only by extract-legacy-fixtures.mjs.
import vm from "node:vm";

/** Index just past the bracket/brace/paren that closes the one at `open`. Skips strings, template literals and comments. */
export function matchClose(src, open) {
  const pairs = { "[": "]", "{": "}", "(": ")" };
  const stack = [];
  let i = open;
  for (; i < src.length; i++) {
    const c = src[i];
    if (c === "'" || c === '"') {
      i++;
      while (src[i] !== c) i += src[i] === "\\" ? 2 : 1;
      continue;
    }
    if (c === "`") {
      i++;
      while (src[i] !== "`") {
        if (src[i] === "\\") i += 2;
        else if (src[i] === "$" && src[i + 1] === "{") i = matchClose(src, i + 1);
        else i++;
      }
      continue;
    }
    if (c === "/" && src[i + 1] === "/") {
      while (src[i] !== "\n") i++;
      continue;
    }
    if (pairs[c]) stack.push(pairs[c]);
    else if (c === "]" || c === "}" || c === ")") {
      if (stack.pop() !== c) throw new Error(`Unbalanced ${c} at ${i}`);
      if (stack.length === 0) return i + 1;
    }
  }
  throw new Error("Unclosed bracket from " + open);
}

/** The script text of a .dc.html file. */
export function legacyScript(html) {
  const start = html.indexOf(">", html.indexOf("<script type=\"text/x-dc\" data-dc-script")) + 1;
  return html.slice(start, html.indexOf("</script>", start));
}

/**
 * Wraps the literal that starts at the first `[`/`{` after the n-th occurrence of `anchor` (searching from `from`)
 * as `(__cap[name] = <literal>)`, so the sandbox records the evaluated value.
 */
export function hook(src, anchor, name, { from = 0, nth = 1 } = {}) {
  let at = from - 1;
  for (let k = 0; k < nth; k++) {
    at = src.indexOf(anchor, at + 1);
    if (at < 0) throw new Error(`hook ${name}: anchor not found: ${anchor}`);
  }
  // The anchor may end with the opening bracket itself ("const P = ["); otherwise use the next bracket after it.
  const open = /[[{]$/.test(anchor) ? at + anchor.length - 1 : at + anchor.length + src.slice(at + anchor.length).search(/[[{]/);
  const close = matchClose(src, open);
  return src.slice(0, open) + `(__cap[${JSON.stringify(name)}] = ` + src.slice(open, close) + ")" + src.slice(close);
}

/** Inserts `code` right before the n-th occurrence of `anchor`. */
export function insertBefore(src, anchor, code, nth = 1) {
  let at = -1;
  for (let k = 0; k < nth; k++) {
    at = src.indexOf(anchor, at + 1);
    if (at < 0) throw new Error("insertBefore: anchor not found: " + anchor);
  }
  return src.slice(0, at) + code + src.slice(at);
}

/** Evaluates the (hooked) legacy script and renders every slide's values with all sections shown. */
export function runLegacy(script) {
  const __cap = {};
  class DCLogic {
    constructor() {
      this.props = {};
      this.state = {};
    }
  }
  const sandbox = { __cap, console, window: { scrollY: 0 }, document: {}, setTimeout: () => 0 };
  vm.createContext(sandbox);
  const Component = vm.runInContext(
    `(function (DCLogic, StreamableLogic, React) {\n${script}\n;return { Component, BRAND_PART, PROMPT_PART, ORDER: typeof ORDER !== "undefined" ? ORDER : null };\n})`,
    sandbox,
  )(DCLogic, DCLogic, { createElement: () => null });
  const host = new Component.Component();
  host.state = { sec: 0, all: true, b: null, p: null };
  host.setState = () => {};
  const vals = host.renderVals();
  return { cap: __cap, vals, parts: host.parts, order: Component.ORDER };
}
