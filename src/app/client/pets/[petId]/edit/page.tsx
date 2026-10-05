import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { updatePetAction } from "@/app/actions/pets";
import { PetForm } from "@/components/pets/PetForm";
import { DashboardHeading } from "@/components/portal/PlaceholderCard";
import { requireRole } from "@/lib/auth/session";
import { todayIso } from "@/lib/dates";
import { isUuid, PET_COLUMNS, type Pet } from "@/lib/pets/constants";
import { getPetImageUrls } from "@/lib/pets/server";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Edit Pet" };

export default async function EditPetPage({ params }: { params: Promise<{ petId: string }> }) {
  const profile = await requireRole(["CLIENT"]);
  const { petId } = await params;
  if (!isUuid(petId)) notFound();

  const supabase = await createClient();
  const { data } = await supabase
    .from("pets")
    .select(PET_COLUMNS)
    .eq("id", petId)
    .eq("owner_id", profile.id)
    .eq("is_archived", false)
    .maybeSingle();
  if (!data) notFound();
  const pet = data as Pet;
  const imageUrls = await getPetImageUrls(supabase, [pet.image_path]);

  return (
    <div className="mx-auto max-w-2xl">
      <Link
        href={`/client/pets/${pet.id}`}
        className="text-sm font-semibold text-brand hover:underline"
      >
        ← Back to {pet.name}
      </Link>
      <div className="mt-4">
        <DashboardHeading title={`Edit ${pet.name}`} subtitle="Update your pet's basic information." />
      </div>
      <section className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">
        <PetForm
          action={updatePetAction.bind(null, pet.id)}
          maxDate={todayIso()}
          submitLabel="Save changes"
          currentImageUrl={pet.image_path ? imageUrls[pet.image_path] : null}
          defaults={{
            name: pet.name,
            species: pet.species,
            speciesOther: pet.species_other ?? "",
            breed: pet.breed,
            gender: pet.gender,
            birthDate: pet.birth_date ?? "",
            colorMarkings: pet.color_markings,
          }}
        />
      </section>
    </div>
  );
}
