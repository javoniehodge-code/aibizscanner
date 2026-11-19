import { z } from "zod";

/**
 * Google Places API (New), server side only. Owner decisions (19 Nov 2026): approved with reviews; Google content is
 * fetched when needed and never stored, except the place ID (Places API policies allow storing place IDs; Google
 * recommends refreshing an ID older than 12 months, which is free). Key: GOOGLE_PLACES_API_KEY (Vercel, secret).
 * Billing is by field: the field masks below ask only for what we show.
 */
export const PLACES_ENDPOINT = "https://places.googleapis.com/v1";
/** Text Search fields for picking the business's listing (Text Search Pro: id, name, address, type, Maps link). */
export const SEARCH_FIELDS = ["places.id", "places.displayName", "places.formattedAddress", "places.primaryTypeDisplayName", "places.googleMapsUri"] as const;
const MAX_CANDIDATES = 5;

export type PlaceCandidate = { id: string; name: string; address: string | null; type: string | null; mapsUrl: string | null };

const searchResponse = z.object({
  places: z
    .array(
      z.object({
        id: z.string(),
        displayName: z.object({ text: z.string() }).partial().optional(),
        formattedAddress: z.string().optional(),
        primaryTypeDisplayName: z.object({ text: z.string() }).partial().optional(),
        googleMapsUri: z.string().optional(),
      }),
    )
    .optional(),
});

export type Fetcher = (url: string, init: RequestInit) => Promise<Response>;

export class PlacesError extends Error {}

/** The Places API key from the environment, or null when it isn't set (the panel then says so). */
export function placesKey(): string | null {
  const v = process.env.GOOGLE_PLACES_API_KEY?.trim();
  return v ? v : null;
}

/** Up to five listings matching the business's name and location. Nothing from the response is stored. */
export async function searchPlaces(query: string, key: string, fetcher: Fetcher = fetch): Promise<PlaceCandidate[]> {
  const res = await fetcher(`${PLACES_ENDPOINT}/places:searchText`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-goog-api-key": key, "x-goog-fieldmask": SEARCH_FIELDS.join(",") },
    body: JSON.stringify({ textQuery: query, pageSize: MAX_CANDIDATES, languageCode: "en" }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    const message = /"message":\s*"([^"]+)"/.exec(detail)?.[1];
    throw new PlacesError(`Google Places refused the search (HTTP ${res.status}${message ? `: ${message}` : ""}).`);
  }
  const parsed = searchResponse.parse(await res.json());
  return (parsed.places ?? []).slice(0, MAX_CANDIDATES).map((p) => ({
    id: p.id,
    name: p.displayName?.text ?? "(no name)",
    address: p.formattedAddress ?? null,
    type: p.primaryTypeDisplayName?.text ?? null,
    mapsUrl: p.googleMapsUri ?? null,
  }));
}

/** Place IDs from Google look like "ChIJ…": letters, digits, "-" and "_". Anything else is refused before saving. */
export const placeIdSchema = z.string().regex(/^[A-Za-z0-9_-]{10,300}$/, "Not a Google place ID");

// ---------------------------------------------------------------------------------------------------------------
// Place Details: read live when a report is shown, never stored (Places API policies).
// ---------------------------------------------------------------------------------------------------------------

/** Place Details fields (Enterprise + Atmosphere, for reviews). Only what the report shows. */
export const DETAILS_FIELDS = [
  "id",
  "displayName",
  "formattedAddress",
  "nationalPhoneNumber",
  "websiteUri",
  "regularOpeningHours.weekdayDescriptions",
  "businessStatus",
  "rating",
  "userRatingCount",
  "reviews",
  "googleMapsUri",
] as const;

const detailsResponse = z.object({
  id: z.string(),
  displayName: z.object({ text: z.string() }).partial().optional(),
  formattedAddress: z.string().optional(),
  nationalPhoneNumber: z.string().optional(),
  websiteUri: z.string().optional(),
  regularOpeningHours: z.object({ weekdayDescriptions: z.array(z.string()).optional() }).optional(),
  businessStatus: z.string().optional(),
  rating: z.number().optional(),
  userRatingCount: z.number().optional(),
  googleMapsUri: z.string().optional(),
  reviews: z
    .array(
      z.object({
        rating: z.number().optional(),
        text: z.object({ text: z.string() }).partial().optional(),
        originalText: z.object({ text: z.string() }).partial().optional(),
        relativePublishTimeDescription: z.string().optional(),
        publishTime: z.string().optional(),
        googleMapsUri: z.string().optional(),
        authorAttribution: z.object({ displayName: z.string().optional(), uri: z.string().optional() }).optional(),
      }),
    )
    .optional(),
});

export type PlaceReview = { author: string; authorUrl: string | null; rating: number | null; when: string | null; publishedAt: string | null; text: string; url: string | null };
export type PlaceDetails = {
  id: string;
  name: string | null;
  address: string | null;
  phone: string | null;
  website: string | null;
  hours: string[];
  status: string | null;
  rating: number | null;
  ratingCount: number | null;
  mapsUrl: string | null;
  reviews: PlaceReview[];
};

/** The listing as Google shows it now. */
export async function placeDetails(placeId: string, key: string, fetcher: Fetcher = fetch): Promise<PlaceDetails> {
  if (!placeIdSchema.safeParse(placeId).success) throw new PlacesError("That isn't a Google place ID.");
  const res = await fetcher(`${PLACES_ENDPOINT}/places/${encodeURIComponent(placeId)}?languageCode=en`, {
    method: "GET",
    headers: { "x-goog-api-key": key, "x-goog-fieldmask": DETAILS_FIELDS.join(",") },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    const message = /"message":\s*"([^"]+)"/.exec(detail)?.[1];
    throw new PlacesError(`Google Places refused the listing (HTTP ${res.status}${message ? `: ${message}` : ""}).`);
  }
  const p = detailsResponse.parse(await res.json());
  return {
    id: p.id,
    name: p.displayName?.text ?? null,
    address: p.formattedAddress ?? null,
    phone: p.nationalPhoneNumber ?? null,
    website: p.websiteUri ?? null,
    hours: p.regularOpeningHours?.weekdayDescriptions ?? [],
    status: p.businessStatus ?? null,
    rating: p.rating ?? null,
    ratingCount: p.userRatingCount ?? null,
    mapsUrl: p.googleMapsUri ?? null,
    reviews: (p.reviews ?? [])
      .map((r) => ({
        author: r.authorAttribution?.displayName ?? "A Google user",
        authorUrl: r.authorAttribution?.uri ?? null,
        rating: r.rating ?? null,
        when: r.relativePublishTimeDescription ?? null,
        publishedAt: r.publishTime ?? null,
        text: (r.text?.text ?? r.originalText?.text ?? "").trim(),
        url: r.googleMapsUri ?? null,
      }))
      .filter((r) => r.text),
  };
}
