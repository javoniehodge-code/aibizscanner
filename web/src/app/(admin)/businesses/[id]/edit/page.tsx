import { notFound } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { BusinessForm } from "../../business-form";
import { toFormDefaults } from "../../defaults";
import { placesKey } from "@/lib/google/places";
import { GoogleListing } from "../../google-listing";

/** Google recommends refreshing a stored place ID once it is over 12 months old. */
function idOlderThanAYear(confirmedAt: string | null): boolean {
  return confirmedAt !== null && Date.now() - new Date(confirmedAt).getTime() > 365 * 24 * 3600 * 1000;
}

export const metadata = { title: "Edit business — AIBizScanner internal" };

export default async function EditBusinessPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const supabase = await createClient();
  const { data, error } = await supabase.from("business").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) notFound();
  return (
    <main>
      <h1>Edit business</h1>
      <GoogleListing businessId={data.id} placeId={data.place_id} confirmedAt={data.place_id_confirmed_at} stale={idOlderThanAYear(data.place_id_confirmed_at)} keySet={placesKey() !== null} />
      <BusinessForm defaults={toFormDefaults(data)} />
    </main>
  );
}
