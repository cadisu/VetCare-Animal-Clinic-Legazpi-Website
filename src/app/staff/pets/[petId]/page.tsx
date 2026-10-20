import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MedicalRecords } from "@/components/clinical/MedicalRecords";
import { PetProfile } from "@/components/pets/PetProfile";
import { Alert } from "@/components/ui/Alert";
import { listActiveVeterinarians, getVeterinarianIdForProfile, listAppointmentsForPet } from "@/lib/appointments/server";
import { requireRole } from "@/lib/auth/session";
import { CLINICAL_NOTICES } from "@/lib/clinical/constants";
import {
  listClinicalRecords,
  listRecordableAppointments,
  listVaccinationRecords,
  listWeightRecords,
} from "@/lib/clinical/server";
import { isUuid, PET_COLUMNS, type Pet } from "@/lib/pets/constants";
import { getPetImageUrls } from "@/lib/pets/server";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Pet Profile" };

/** Staff can record weight. Senior Vet can also write official clinical and vaccination records. */
export default async function StaffPetPage({
  params,
  searchParams,
}: {
  params: Promise<{ petId: string }>;
  searchParams: Promise<{ message?: string }>;
}) {
  const profile = await requireRole(["STAFF", "SENIOR_VET"]);
  const { petId } = await params;
  const { message } = await searchParams;
  if (!isUuid(petId)) notFound();

  const supabase = await createClient();
  const { data } = await supabase.from("pets").select(PET_COLUMNS).eq("id", petId).maybeSingle();
  if (!data) notFound();
  const pet = data as Pet;
  const isSeniorVet = profile.role === "SENIOR_VET";

  const [{ data: owner }, imageUrls, appointmentHistory, weights, clinical, vaccinations, appointments, veterinarians, linkedVetId] =
    await Promise.all([
      supabase.from("profiles").select("id, full_name, contact_number").eq("id", pet.owner_id).maybeSingle(),
      getPetImageUrls(supabase, [pet.image_path]),
      listAppointmentsForPet(supabase, pet.id),
      listWeightRecords(supabase, pet.id),
      listClinicalRecords(supabase, pet.id),
      listVaccinationRecords(supabase, pet.id),
      listRecordableAppointments(supabase, pet.id),
      isSeniorVet ? listActiveVeterinarians(supabase) : Promise.resolve([]),
      isSeniorVet ? getVeterinarianIdForProfile(supabase, profile.id) : Promise.resolve(null),
    ]);
  const notice = message ? CLINICAL_NOTICES[message] : undefined;

  return (
    <>
      <Link
        href={owner ? `/staff/clients/${owner.id}` : "/staff/clients"}
        className="text-sm font-semibold text-brand hover:underline"
      >
        ← Back to {owner?.full_name || "Clients"}
      </Link>
      {notice && (
        <div className="mt-4">
          <Alert variant="success">{notice}</Alert>
        </div>
      )}
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
          records={
            <MedicalRecords
              petId={pet.id}
              returnTo={`/staff/pets/${pet.id}`}
              weights={weights}
              clinical={clinical}
              vaccinations={vaccinations}
              canRecordWeight={!pet.is_archived}
              canEditMedical={isSeniorVet && !pet.is_archived}
              veterinarians={veterinarians}
              appointments={appointments}
              defaultVeterinarianId={linkedVetId}
            />
          }
        />
      </div>
    </>
  );
}
