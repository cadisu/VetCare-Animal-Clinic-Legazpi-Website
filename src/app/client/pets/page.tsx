import type { Metadata } from "next";
import Link from "next/link";
import { PetCard } from "@/components/pets/PetCard";
import { DashboardHeading } from "@/components/portal/PlaceholderCard";
import { Alert } from "@/components/ui/Alert";
import { buttonClass } from "@/components/ui/button-styles";
import { PawIcon } from "@/components/ui/icons";
import { requireRole } from "@/lib/auth/session";
import { PET_COLUMNS, type Pet } from "@/lib/pets/constants";
import { getPetImageUrls } from "@/lib/pets/server";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "My Pets" };

export default async function MyPetsPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string }>;
}) {
  const profile = await requireRole(["CLIENT"]);
  const { message } = await searchParams;

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
    <>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <DashboardHeading title="My Pets" />
        <Link href="/client/pets/new" className={buttonClass("primary", "md", "mb-8")}>
          Register a pet
        </Link>
      </div>

      {message === "archived" && (
        <div className="mb-6">
          <Alert variant="success">The pet has been removed from your list.</Alert>
        </div>
      )}

      {pets.length === 0 ? (
        <section className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <PawIcon className="mx-auto size-12 text-brand" />
          <h2 className="mt-4 text-lg font-semibold">No pets yet</h2>
          <p className="mt-1 text-sm text-slate-600">
            Register your pet so the clinic can keep their records in one place.
          </p>
          <Link href="/client/pets/new" className={buttonClass("primary", "md", "mt-6")}>
            Register a pet
          </Link>
        </section>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {pets.map((pet) => (
            <PetCard
              key={pet.id}
              pet={pet}
              href={`/client/pets/${pet.id}`}
              imageUrl={pet.image_path ? imageUrls[pet.image_path] : undefined}
            />
          ))}
        </div>
      )}
    </>
  );
}
