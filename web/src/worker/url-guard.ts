import dns from "node:dns/promises";
import ipaddr from "ipaddr.js";

/** The protected fetcher's address check (see fetcher.ts). Separate so it can be unit-tested. */
export class RefusedUrlError extends Error {}

/** Refuses anything but a public http(s) URL whose host resolves only to public unicast addresses. */
export async function assertPublicUrl(raw: string, resolve: (host: string) => Promise<string[]> = defaultResolve): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new RefusedUrlError(`Not a URL: ${raw}`);
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new RefusedUrlError(`Only http and https are fetched (${url.protocol})`);
  if (url.username || url.password) throw new RefusedUrlError("URLs with credentials are not fetched");
  if (url.port && url.port !== "80" && url.port !== "443") throw new RefusedUrlError(`Port ${url.port} is not fetched`);
  const host = url.hostname.replace(/^\[|\]$/g, "");
  const addresses = ipaddr.isValid(host) ? [host] : await resolve(host);
  if (!addresses.length) throw new RefusedUrlError(`${host} did not resolve`);
  for (const a of addresses) {
    const parsed = ipaddr.process(a);
    if (parsed.range() !== "unicast") throw new RefusedUrlError(`${host} resolves to a non-public address (${parsed.range()})`);
  }
  return url;
}

async function defaultResolve(host: string): Promise<string[]> {
  try {
    return (await dns.lookup(host, { all: true, verbatim: true })).map((r) => r.address);
  } catch {
    return [];
  }
}

