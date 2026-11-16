import { describe, expect, it } from "vitest";
import { assertPublicUrl } from "./url-guard";

const resolveTo = (...addrs: string[]) => async () => addrs;

describe("protected fetcher address check", () => {
  it("allows public http(s) hosts", async () => {
    await expect(assertPublicUrl("https://mvpmiami.com/cars", resolveTo("104.21.3.4"))).resolves.toBeInstanceOf(URL);
    await expect(assertPublicUrl("http://example.com/", resolveTo("2606:4700::6810:1"))).resolves.toBeInstanceOf(URL);
  });
  it("refuses private, loopback, link-local and metadata addresses, literal or resolved", async () => {
    for (const [url, addr] of [
      ["http://127.0.0.1/", "127.0.0.1"],
      ["http://localhost/", "127.0.0.1"],
      ["http://intranet.example/", "10.1.2.3"],
      ["http://router.example/", "192.168.1.1"],
      ["http://169.254.169.254/latest/meta-data", "169.254.169.254"],
      ["http://[::1]/", "::1"],
      ["http://v6.example/", "fd00::1"],
      ["http://mixed.example/", "93.184.216.34"], // second address below is private
    ] as const) {
      const resolve = url.includes("mixed") ? resolveTo(addr, "10.0.0.5") : resolveTo(addr);
      await expect(assertPublicUrl(url, resolve), url).rejects.toThrow(/non-public|resolves/);
    }
  });
  it("refuses other schemes, ports, credentials and unresolvable hosts", async () => {
    await expect(assertPublicUrl("ftp://example.com/", resolveTo("93.184.216.34"))).rejects.toThrow(/http and https/);
    await expect(assertPublicUrl("http://example.com:8080/", resolveTo("93.184.216.34"))).rejects.toThrow(/Port 8080/);
    await expect(assertPublicUrl("https://user:pw@example.com/", resolveTo("93.184.216.34"))).rejects.toThrow(/credentials/);
    await expect(assertPublicUrl("https://nowhere.invalid/", resolveTo())).rejects.toThrow(/did not resolve/);
  });
});
