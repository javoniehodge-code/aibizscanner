"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { PlacesError, placeIdSchema, placesKey, searchPlaces, type PlaceCandidate } from "@/lib/google/places";
import { createClient } from "@/lib/supabase/server";

export type ListingSearch = { ok: true; query: string; candidates: PlaceCandidate[] } | { ok: false; error: string };

const idSchema = z.uuid();

/** Searches Google for the business's listing by its name and location. The results are shown, not stored. */
export async function findListing(businessId: string): Promise<ListingSearch> {
  await requireAdmin();
  const id = idSchema.safeParse(businessId);
  if (!id.success) return { ok: false, error: "Unknown business." };
  const key = placesKey();
  if (!key) return { ok: false, error: "The Google Places key isn't set (GOOGLE_PLACES_API_KEY in Vercel)." };
  const supabase = await createClient();
  const { data, error } = await supabase.from("business").select("name, location").eq("id", id.data).maybeSingle();
  if (error || !data) return { ok: false, error: "Unknown business." };
  const query = `${data.name}, ${data.location}`;
  try {
    return { ok: true, query, candidates: await searchPlaces(query, key) };
  } catch (e) {
    return { ok: false, error: e instanceof PlacesError ? e.message : "Google Places couldn't be reached. Try again." };
  }
}

/** Stores the confirmed listing's place ID (the only Google value we keep), or clears it. */
export async function confirmListing(businessId: string, placeId: string | null): Promise<{ ok: boolean; error?: string }> {
  await requireAdmin();
  const id = idSchema.safeParse(businessId);
  if (!id.success) return { ok: false, error: "Unknown business." };
  if (placeId !== null && !placeIdSchema.safeParse(placeId).success) return { ok: false, error: "That isn't a Google place ID." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("business")
    .update({ place_id: placeId, place_id_confirmed_at: placeId ? new Date().toISOString() : null })
    .eq("id", id.data);
  if (error) return { ok: false, error: `Could not save: ${error.message}` };
  revalidatePath(`/businesses/${id.data}/edit`);
  return { ok: true };
}
