/**
 * Builds the HTML served to the report iframe: the template with the report JSON set as window.__REPORT__ and a
 * <base> pointing at the template's runtime files (support.js, vendored React/Babel).
 * The JSON is escaped so report text can never close the script tag or break out of it.
 */
export function injectReport(templateHtml: string, document: unknown, baseHref: string): string {
  const json = JSON.stringify(document)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
  const head = /<head[^>]*>/i.exec(templateHtml);
  if (!head) throw new Error("Report template has no <head>");
  const at = head.index + head[0].length;
  const base = baseHref.replace(/"/g, "&quot;");
  return `${templateHtml.slice(0, at)}\n<base href="${base}">\n<script>window.__REPORT__ = ${json};</script>${templateHtml.slice(at)}`;
}
