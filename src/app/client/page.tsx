import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PetAvatar } from "@/components/pets/PetAvatar";
import { DashboardHeading, PlaceholderCard } from "@/components/portal/PlaceholderCard";
import { buttonClass } from "@/components/ui/button-styles";
import { requireRole } from "@/lib/auth/session";
import { PET_COLUMNS, speciesLabel, type Pet } from "@/lib/pets/constants";
import { getPetImageUrls } from "@/lib/pets/server";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Client Dashboard" };

export default async function ClientDashboardPage() {
  // Re-check on the page itself: layouts are not re-run on every client-side navigation.
  const profile = await requireRole(["CLIENT"]);
  if (!profile.onboarded_at) redirect("/client/get-started");

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
      <DashboardHeading
        title={`Welcome, ${profile.first_name || "there"}!`}
        subtitle="Here's an overview of your pets and appointments."
      />
      <div className="grid gap-6 md:grid-cols-2">
        <PlaceholderCard
          title="Upcoming Appointment"
          description="Your next appointment (pet, service, date, time and status) will appear here."
        />
        <section className="rounded-2xl border border-slate-200 bg-white p-6">
          <div className="flex items-start justify-between gap-3">
            <h2 className="text-base font-semibold text-slate-900">My Pets</h2>
            <Link href="/client/pets" className="text-sm font-semibold text-brand hover:underline">
              View all
            </Link>
          </div>
          {pets.length === 0 ? (
            <div className="mt-3">
              <p className="text-sm text-slate-600">You haven&apos;t registered any pets yet.</p>
              <Link href="/client/pets/new" className={buttonClass("primary", "md", "mt-4")}>
                Register a pet
              </Link>
            </div>
          ) : (
            <ul className="mt-4 space-y-3">
              {pets.slice(0, 4).map((pet) => (
                <li key={pet.id}>
                  <Link
                    href={`/client/pets/${pet.id}`}
                    className="flex items-center gap-3 rounded-lg p-1 hover:bg-brand-soft/60"
                  >
                    <PetAvatar
                      url={pet.image_path ? imageUrls[pet.image_path] : null}
                      name={pet.name}
                      className="size-12"
                    />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-900">{pet.name}</p>
                      <p className="truncate text-xs text-slate-500">
                        {speciesLabel(pet)} · {pet.breed}
                      </p>
                    </div>
                  </Link>
                </li>
              ))}
              {pets.length > 4 && (
                <li className="text-sm text-slate-500">and {pets.length - 4} more…</li>
              )}
            </ul>
          )}
        </section>
        <PlaceholderCard
          title="Loyalty"
          description="Your digital stamp card and available rewards will appear here."
        />
        <PlaceholderCard
          title="Recent Activity"
          description="Your recent appointments and services will appear here."
        />
      </div>
    </>
  );
}
