import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { completeOnboardingAction, createPetAction } from "@/app/actions/pets";
import { PetCard } from "@/components/pets/PetCard";
import { PetForm } from "@/components/pets/PetForm";
import { DashboardHeading } from "@/components/portal/PlaceholderCard";
import { Alert } from "@/components/ui/Alert";
import { buttonClass } from "@/components/ui/button-styles";
import { requireRole } from "@/lib/auth/session";
import { todayIso } from "@/lib/dates";
import { PET_COLUMNS, type Pet } from "@/lib/pets/constants";
import { getPetImageUrls } from "@/lib/pets/server";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Register Your Pets" };

/** Optional step shown after a client's first login: register one or more pets, or skip. */
export default async function GetStartedPage({
  searchParams,
}: {
  searchParams: Promise<{ added?: string }>;
}) {
  const profile = await requireRole(["CLIENT"]);
  if (profile.onboarded_at) redirect("/client/pets/new");
  const { added } = await searchParams;

  const supabase = await createClient();
  const { data } = await supabase
    .from("pets")
    .select(PET_COLUMNS)
    .eq("owner_id", profile.id)
    .eq("is_archived", false)
    .order("created_at", { ascending: true });
  const pets = (data ?? []) as Pet[];
  const imageUrls = await getPetImageUrls(supabase, pets.map((p) => p.image_path));

  return (
    <div className="mx-auto max-w-2xl">
      <DashboardHeading
        title={`Welcome, ${profile.first_name || "there"}!`}
        subtitle={
          pets.length === 0
            ? "Your account is ready. Would you like to register your pet now? You can also do this later from My Pets."
            : "Add another pet, or finish when you're done."
        }
      />

      {added && pets.length > 0 && (
        <div className="mb-6">
          <Alert variant="success">{added.slice(0, 60)} has been registered.</Alert>
        </div>
      )}

      {pets.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
            Registered so far ({pets.length})
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {pets.map((pet) => (
              <PetCard
                key={pet.id}
                pet={pet}
                href={`/client/pets/${pet.id}`}
                imageUrl={pet.image_path ? imageUrls[pet.image_path] : undefined}
              />
            ))}
          </div>
        </section>
      )}

      <section className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">
        <h2 className="mb-6 text-lg font-semibold">
          {pets.length === 0 ? "Register your pet" : "Register another pet"}
        </h2>
        {/* Keyed by count so the form starts empty after each pet is saved. */}
        <PetForm
          key={pets.length}
          action={createPetAction}
          maxDate={todayIso()}
          returnTo="onboarding"
          submitLabel={pets.length === 0 ? "Save pet" : "Save and add another"}
        />
      </section>

      <form action={completeOnboardingAction} className="mt-6 flex justify-center">
        {pets.length === 0 ? (
          <button
            type="submit"
            name="intent"
            value="skip"
            className={buttonClass("ghost", "md")}
          >
            Skip for now
          </button>
        ) : (
          <button
            type="submit"
            name="intent"
            value="finish"
            className={buttonClass("outline", "lg")}
          >
            I&apos;m done — go to My Pets
          </button>
        )}
      </form>
    </div>
  );
}
