import { describe, expect, it } from "vitest";
import { PlacesError, SEARCH_FIELDS, placeIdSchema, searchPlaces } from "./places";

describe("Google Places search", () => {
  it("asks only for the listing fields we show, with the key in a header, and reads the candidates", async () => {
    const seen: { url: string; init: RequestInit }[] = [];
    const fetcher = async (url: string, init: RequestInit) => {
      seen.push({ url, init });
      return new Response(
        JSON.stringify({
          places: [
            { id: "ChIJ_mvp_miami_1", displayName: { text: "MVP Miami" }, formattedAddress: "2500 NW 39th St, Miami, FL 33142, USA", primaryTypeDisplayName: { text: "Car rental agency" }, googleMapsUri: "https://maps.google.com/?cid=1" },
            { id: "ChIJ_other_00002", displayName: { text: "MVP Rentals" } },
          ],
        }),
        { status: 200 },
      );
    };
    const out = await searchPlaces("MVP Miami, Miami, FL", "test-key", fetcher);
    expect(seen[0]!.url).toBe("https://places.googleapis.com/v1/places:searchText");
    const h = seen[0]!.init.headers as Record<string, string>;
    expect(h["x-goog-api-key"]).toBe("test-key");
    expect(h["x-goog-fieldmask"]).toBe(SEARCH_FIELDS.join(","));
    expect(JSON.parse(seen[0]!.init.body as string)).toEqual({ textQuery: "MVP Miami, Miami, FL", pageSize: 5, languageCode: "en" });
    expect(out).toEqual([
      { id: "ChIJ_mvp_miami_1", name: "MVP Miami", address: "2500 NW 39th St, Miami, FL 33142, USA", type: "Car rental agency", mapsUrl: "https://maps.google.com/?cid=1" },
      { id: "ChIJ_other_00002", name: "MVP Rentals", address: null, type: null, mapsUrl: null },
    ]);
  });

  it("reports Google's refusal in plain words, and handles no matches", async () => {
    const refused = async () => new Response(JSON.stringify({ error: { code: 403, message: "Places API (New) has not been used in project 1 before or it is disabled." } }), { status: 403 });
    await expect(searchPlaces("x", "k", refused)).rejects.toThrow(new PlacesError("Google Places refused the search (HTTP 403: Places API (New) has not been used in project 1 before or it is disabled.)."));
    expect(await searchPlaces("x", "k", async () => new Response("{}", { status: 200 }))).toEqual([]);
  });

  it("accepts only place-ID-shaped values", () => {
    expect(placeIdSchema.safeParse("ChIJN1t_tDeuEmsRUsoyG83frY4").success).toBe(true);
    expect(placeIdSchema.safeParse("ChIJ<script>").success).toBe(false);
  });
});
