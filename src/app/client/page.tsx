import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ClientUpcomingPreview } from "@/components/appointments/ClientUpcomingPreview";
import { PetAvatar } from "@/components/pets/PetAvatar";
import { StampCard } from "@/components/loyalty/StampCard";
import { DashboardHeading } from "@/components/portal/PlaceholderCard";
import { buttonClass } from "@/components/ui/button-styles";
import { panelPaddingClass } from "@/components/ui/panel-styles";
import { listAppointmentsForClient, splitClientAppointments } from "@/lib/appointments/server";
import { requireRole } from "@/lib/auth/session";
import { formatDate } from "@/lib/dates";
import { speciesLabel, PET_COLUMNS, type Pet } from "@/lib/pets/constants";
import { nextMilestone, stampsRemaining } from "@/lib/loyalty/card";
import { getClientCard } from "@/lib/loyalty/server";
import { formatPeso } from "@/lib/pos/money";
import { listClientReceipts } from "@/lib/pos/receipts";
import { getPetImageUrls } from "@/lib/pets/server";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Client Dashboard" };

export default async function ClientDashboardPage() {
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
  const { upcomingPreview } = splitClientAppointments(
    await listAppointmentsForClient(supabase, profile.id),
  );
  const recentReceipts = (await listClientReceipts(supabase)).slice(0, 3);
  const loyalty = await getClientCard(supabase);
  const loyaltyLimit = loyalty.program?.stampLimit ?? 12;
  const loyaltyLeft = stampsRemaining(loyalty.stampCount, loyalty.milestones, loyaltyLimit);
  const loyaltyNext = nextMilestone(loyalty.stampCount, loyalty.milestones, loyaltyLimit);

  return (
    <>
      <DashboardHeading
        title={`Welcome, ${profile.first_name || "there"}!`}
        subtitle="Here's an overview of your pets and appointments."
      />
      <div className="grid gap-6 md:grid-cols-2">
        <section className={panelPaddingClass("md:col-span-2 lg:col-span-1")}>
          <div className="flex items-start justify-between gap-3">
            <h2 className="text-base font-semibold text-ink">Upcoming Appointments</h2>
            <Link href="/client/appointments" className="text-sm font-semibold text-brand hover:underline">
              View all
            </Link>
          </div>
          <ClientUpcomingPreview
            appointments={upcomingPreview}
            detailHref={(id) => `/client/appointments/${id}`}
          />
          <Link href="/client/appointments/new" className={buttonClass("primary", "md", "mt-4 inline-flex")}>
            Book an appointment
          </Link>
        </section>
        <section className={panelPaddingClass()}>
          <div className="flex items-start justify-between gap-3">
            <h2 className="text-base font-semibold text-ink">My Pets</h2>
            <Link href="/client/pets" className="text-sm font-semibold text-brand hover:underline">
              View all
            </Link>
          </div>
          {pets.length === 0 ? (
            <div className="mt-3">
              <p className="text-sm text-muted">You haven&apos;t registered any pets yet.</p>
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
                    className="flex items-center gap-3 rounded-lg p-1 hover:bg-highlight/80"
                  >
                    <PetAvatar
                      url={pet.image_path ? imageUrls[pet.image_path] : null}
                      name={pet.name}
                      className="size-12"
                    />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-ink">{pet.name}</p>
                      <p className="truncate text-xs text-muted">
                        {speciesLabel(pet)} · {pet.breed}
                      </p>
                    </div>
                  </Link>
                </li>
              ))}
              {pets.length > 4 && (
                <li className="text-sm text-muted">and {pets.length - 4} more…</li>
              )}
            </ul>
          )}
        </section>
        <section className={panelPaddingClass("md:col-span-2")}>
          <div className="flex items-start justify-between gap-3">
            <h2 className="text-base font-semibold text-ink">Loyalty</h2>
            <Link href="/client/loyalty" className="text-sm font-semibold text-brand hover:underline">
              View card
            </Link>
          </div>
          {!loyalty.program?.isActive && loyalty.stampCount === 0 ? (
            <p className="mt-3 text-sm text-muted">Your stamp card will appear here when the clinic loyalty program is active.</p>
          ) : (
            <>
              <p className="mt-3 text-sm font-semibold text-ink">
                {loyalty.stampCount} / {loyaltyLimit} stamps
              </p>
              <div className="mt-3">
                <StampCard count={loyalty.stampCount} limit={loyaltyLimit} rewards={loyalty.rewardMarks} />
              </div>
              <p className="mt-3 text-sm text-muted">
                {loyaltyLeft === 0
                  ? "This card is full."
                  : `${loyaltyLeft} to go${loyaltyNext ? ` for the ${loyaltyNext}-stamp reward` : ""}.`}
              </p>
            </>
          )}
        </section>
        <section className={panelPaddingClass()}>
          <div className="flex items-start justify-between gap-3">
            <h2 className="text-base font-semibold text-ink">Recent receipts</h2>
            <Link href="/client/receipts" className="text-sm font-semibold text-brand hover:underline">
              View all
            </Link>
          </div>
          {recentReceipts.length === 0 ? (
            <p className="mt-3 text-sm text-muted">No receipts yet.</p>
          ) : (
            <ul className="mt-4 space-y-3">
              {recentReceipts.map((receipt) => (
                <li key={receipt.id}>
                  <Link href={`/client/receipts/${receipt.id}`} className="block rounded-lg p-1 hover:bg-highlight/80">
                    <span className="flex items-baseline justify-between gap-3">
                      <span className="text-sm font-semibold text-ink">{receipt.reference}</span>
                      <span className="text-sm text-ink">{formatPeso(receipt.total)}</span>
                    </span>
                    <span className="mt-0.5 block text-xs text-muted">
                      {formatDate(receipt.occurredAt)}
                      {receipt.status === "VOIDED" ? " · Voided" : ""}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
