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

describe("Google Place Details", () => {
  it("reads the listing with only the fields the report shows, keeping each review's author", async () => {
    const { DETAILS_FIELDS, placeDetails } = await import("./places");
    let seen: { url: string; init: RequestInit } | null = null;
    const fetcher = async (url: string, init: RequestInit) => {
      seen = { url, init };
      return new Response(
        JSON.stringify({
          id: "ChIJ19s3fbi72YgR0SQuauvlGg0",
          displayName: { text: "MVP Miami" },
          formattedAddress: "2500 NW 39th St, Miami, FL 33142, USA",
          nationalPhoneNumber: "(786) 877-4317",
          regularOpeningHours: { weekdayDescriptions: ["Monday: 9:30 AM – 9:30 PM"] },
          businessStatus: "OPERATIONAL",
          rating: 4.9,
          userRatingCount: 412,
          googleMapsUri: "https://maps.google.com/?cid=9",
          reviews: [
            { rating: 5, text: { text: "Great cars and service." }, relativePublishTimeDescription: "2 weeks ago", authorAttribution: { displayName: "Ana R.", uri: "https://www.google.com/maps/contrib/1" }, googleMapsUri: "https://www.google.com/maps/reviews/1" },
            { rating: 4, text: { text: "" } },
          ],
        }),
        { status: 200 },
      );
    };
    const d = await placeDetails("ChIJ19s3fbi72YgR0SQuauvlGg0", "k", fetcher);
    expect(seen!.url).toBe("https://places.googleapis.com/v1/places/ChIJ19s3fbi72YgR0SQuauvlGg0?languageCode=en");
    expect((seen!.init.headers as Record<string, string>)["x-goog-fieldmask"]).toBe(DETAILS_FIELDS.join(","));
    expect(d).toMatchObject({ name: "MVP Miami", phone: "(786) 877-4317", hours: ["Monday: 9:30 AM – 9:30 PM"], rating: 4.9, ratingCount: 412 });
    expect(d.reviews).toEqual([{ author: "Ana R.", authorUrl: "https://www.google.com/maps/contrib/1", rating: 5, when: "2 weeks ago", publishedAt: null, text: "Great cars and service.", url: "https://www.google.com/maps/reviews/1" }]);
    await expect(placeDetails("not a place id!", "k", fetcher)).rejects.toThrow("That isn't a Google place ID.");
  });
});
