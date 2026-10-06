import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PetProfile } from "@/components/pets/PetProfile";
import { requireRole } from "@/lib/auth/session";
import { isUuid, PET_COLUMNS, type Pet } from "@/lib/pets/constants";
import { listAppointmentsForPet } from "@/lib/appointments/server";
import { getPetImageUrls } from "@/lib/pets/server";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Pet Profile" };

/** Read-only for Staff and Senior Vet in Phase 2 (weight / protected-info editing comes later). */
export default async function StaffPetPage({ params }: { params: Promise<{ petId: string }> }) {
  await requireRole(["STAFF", "SENIOR_VET"]);
  const { petId } = await params;
  if (!isUuid(petId)) notFound();

  const supabase = await createClient();
  const { data } = await supabase.from("pets").select(PET_COLUMNS).eq("id", petId).maybeSingle();
  if (!data) notFound();
  const pet = data as Pet;

  const [{ data: owner }, imageUrls, appointmentHistory] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, full_name, contact_number")
      .eq("id", pet.owner_id)
      .maybeSingle(),
    getPetImageUrls(supabase, [pet.image_path]),
    listAppointmentsForPet(supabase, pet.id),
  ]);

  return (
    <>
      <Link
        href={owner ? `/staff/clients/${owner.id}` : "/staff/clients"}
        className="text-sm font-semibold text-brand hover:underline"
      >
        ← Back to {owner?.full_name || "Clients"}
      </Link>
      <div className="mt-4">
        <PetProfile
          pet={pet}
          imageUrl={pet.image_path ? imageUrls[pet.image_path] : undefined}
          ownerName={
            owner ? (
              <Link href={`/staff/clients/${owner.id}`} className="text-brand hover:underline">
                {owner.full_name}
                {owner.contact_number ? ` · ${owner.contact_number}` : ""}
              </Link>
            ) : (
              "—"
            )
          }
          appointmentHistory={appointmentHistory}
        />
      </div>
    </>
  );
}
