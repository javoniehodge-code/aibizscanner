import { notFound } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { BusinessForm } from "../../business-form";
import { toFormDefaults } from "../../defaults";
import { IdentityCheckPlaceholder } from "../../identity-check-placeholder";

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
      <IdentityCheckPlaceholder placeId={data.place_id} />
      <BusinessForm defaults={toFormDefaults(data)} />
    </main>
  );
}
