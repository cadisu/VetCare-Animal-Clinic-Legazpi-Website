import type { Metadata } from "next";
import { Suspense } from "react";
import { BookingWizard } from "@/components/appointments/BookingWizard";
import { DashboardHeading } from "@/components/portal/PlaceholderCard";
import { listActiveVeterinarians, listBookableServices } from "@/lib/appointments/server";
import { requireRole } from "@/lib/auth/session";
import { PET_COLUMNS, type Pet } from "@/lib/pets/constants";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Book Appointment" };

function BookingWizardFallback() {
  return <p className="text-sm text-slate-600">Loading booking form…</p>;
}

export default async function ClientBookAppointmentPage() {
  const profile = await requireRole(["CLIENT"]);
  const supabase = await createClient();

  const services = await listBookableServices(supabase);
  const veterinarians = await listActiveVeterinarians(supabase);
  const initialServiceId = services[0]?.id ?? "";
  const initialVetId = services[0]?.requires_veterinarian
    ? (veterinarians[0]?.id ?? null)
    : null;

  const { data: petsData } = await supabase
    .from("pets")
    .select(PET_COLUMNS)
    .eq("owner_id", profile.id)
    .eq("is_archived", false)
    .order("name");
  const pets = (petsData ?? []) as Pet[];

  return (
    <>
      <DashboardHeading title="Book an appointment" />
      <Suspense fallback={<BookingWizardFallback />}>
        <BookingWizard
          services={services}
          veterinarians={veterinarians}
          pets={pets}
          initialServiceId={initialServiceId}
          initialVetId={initialVetId}
        />
      </Suspense>
    </>
  );
}
