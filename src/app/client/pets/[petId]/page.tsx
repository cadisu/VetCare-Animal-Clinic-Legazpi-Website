import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { archivePetAction } from "@/app/actions/pets";
import { PetProfile } from "@/components/pets/PetProfile";
import { Alert } from "@/components/ui/Alert";
import { buttonClass } from "@/components/ui/button-styles";
import { ConfirmSubmitButton } from "@/components/ui/ConfirmSubmitButton";
import { requireRole } from "@/lib/auth/session";
import { isUuid, PET_COLUMNS, type Pet } from "@/lib/pets/constants";
import { listAppointmentsForPet } from "@/lib/appointments/server";
import { getPetImageUrls } from "@/lib/pets/server";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Pet Profile" };

const MESSAGES: Record<string, string> = {
  created: "Your pet has been registered.",
  updated: "Your pet's information has been updated.",
};

export default async function ClientPetPage({
  params,
  searchParams,
}: {
  params: Promise<{ petId: string }>;
  searchParams: Promise<{ message?: string }>;
}) {
  const profile = await requireRole(["CLIENT"]);
  const { petId } = await params;
  const { message } = await searchParams;
  if (!isUuid(petId)) notFound();

  const supabase = await createClient();
  // RLS limits clients to their own pets; the owner filter is a second guard.
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
  const appointmentHistory = await listAppointmentsForPet(supabase, pet.id);

  return (
    <>
      <Link href="/client/pets" className="text-sm font-semibold text-brand hover:underline">
        ← Back to My Pets
      </Link>
      {message && MESSAGES[message] && (
        <div className="mt-4">
          <Alert variant="success">{MESSAGES[message]}</Alert>
        </div>
      )}
      <div className="mt-4">
        <PetProfile
          pet={pet}
          imageUrl={pet.image_path ? imageUrls[pet.image_path] : undefined}
          actions={
            <>
              <Link href={`/client/pets/${pet.id}/edit`} className={buttonClass("primary")}>
                Edit
              </Link>
              <form action={archivePetAction.bind(null, pet.id)}>
                <ConfirmSubmitButton
                  confirmMessage={`Remove ${pet.name} from your pets? The clinic will keep ${pet.name}'s records.`}
                  pendingText="Removing..."
                >
                  Remove
                </ConfirmSubmitButton>
              </form>
            </>
          }
          appointmentHistory={appointmentHistory}
          appointmentsHref="/client/appointments"
        />
      </div>
    </>
  );
}
