import type { Metadata } from "next";
import Link from "next/link";
import { AppointmentCard } from "@/components/appointments/AppointmentCard";
import { DashboardHeading, PlaceholderCard } from "@/components/portal/PlaceholderCard";
import { panelPaddingClass } from "@/components/ui/panel-styles";
import { CLIENT_UPCOMING_PREVIEW_LIMIT } from "@/lib/appointments/constants";
import {
  filterAppointmentsForVeterinarian,
  getVeterinarianIdForProfile,
  listAppointmentsForDay,
  listFutureClinicAppointments,
} from "@/lib/appointments/server";
import { requireRole } from "@/lib/auth/session";
import { todayIso } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Senior Vet Dashboard" };

export default async function SeniorVetDashboardPage() {
  const profile = await requireRole(["SENIOR_VET"]);
  const firstName = profile.first_name || "Doc";
  const today = todayIso();
  const supabase = await createClient();

  let todayAppointments: Awaited<ReturnType<typeof listAppointmentsForDay>> = [];
  let futureAppointments: Awaited<ReturnType<typeof listFutureClinicAppointments>> = [];
  let veterinarianId: string | null = null;
  let loadError = false;
  try {
    const [dayRows, futureRows, linkedVetId] = await Promise.all([
      listAppointmentsForDay(supabase, today),
      listFutureClinicAppointments(supabase),
      getVeterinarianIdForProfile(supabase, profile.id),
    ]);
    veterinarianId = linkedVetId;
    todayAppointments = filterAppointmentsForVeterinarian(dayRows, linkedVetId);
    futureAppointments = futureRows;
  } catch {
    loadError = true;
  }

  const todayPreview = todayAppointments.slice(0, CLIENT_UPCOMING_PREVIEW_LIMIT);
  const futurePreview = futureAppointments.slice(0, CLIENT_UPCOMING_PREVIEW_LIMIT);

  return (
    <>
      <DashboardHeading
        title={`Welcome, ${firstName}!`}
        subtitle="Today's visits and what is coming up next."
      />

      {loadError && (
        <p className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          Appointments could not be loaded. Refresh the page to try again.
        </p>
      )}

      <div className="space-y-6">
        <section className={panelPaddingClass()}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-ink">Today&apos;s Appointments</h2>
              <p className="mt-1 text-sm text-muted">
                {!veterinarianId
                  ? "Your account is not linked to a veterinarian, so your own visits cannot be listed."
                  : todayAppointments.length === 0
                    ? "No visits assigned to you today."
                    : `${todayAppointments.length} assigned to you today.`}
              </p>
            </div>
            <Link href="/senior-vet/appointments" className="text-sm font-semibold text-brand hover:underline">
              View all
            </Link>
          </div>
          {todayPreview.length > 0 && (
            <ul className="mt-4 space-y-2">
              {todayPreview.map((appointment) => (
                <li key={appointment.id}>
                  <AppointmentCard
                    appointment={appointment}
                    href={`/senior-vet/appointments/${appointment.id}`}
                    detailsHref={`/senior-vet/appointments/${appointment.id}`}
                    showClient
                    showStatusActions
                    showStaffActions
                    actorRole="SENIOR_VET"
                    staffDay={today}
                    returnTo="/senior-vet"
                  />
                </li>
              ))}
            </ul>
          )}
          {todayAppointments.length > todayPreview.length && (
            <p className="mt-3 text-sm text-muted">
              Showing {todayPreview.length} of {todayAppointments.length}. The rest are on Today&apos;s appointment.
            </p>
          )}
        </section>

        <section className={panelPaddingClass()}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-ink">Upcoming appointments</h2>
              <p className="mt-1 text-sm text-muted">Visits after today for every veterinarian, nearest first.</p>
            </div>
            <Link
              href="/senior-vet/appointments/future"
              className="text-sm font-semibold text-brand hover:underline"
            >
              View all
            </Link>
          </div>
          {futurePreview.length === 0 ? (
            <p className="mt-4 text-sm text-muted">No upcoming appointments after today.</p>
          ) : (
            <ul className="mt-4 space-y-2">
              {futurePreview.map((appointment) => (
                <li key={appointment.id}>
                  <AppointmentCard
                    appointment={appointment}
                    href={`/senior-vet/appointments/${appointment.id}`}
                    detailsHref={`/senior-vet/appointments/${appointment.id}`}
                    showClient
                    showStatusActions
                    showStaffActions
                    actorRole="SENIOR_VET"
                    returnTo="/senior-vet"
                  />
                </li>
              ))}
            </ul>
          )}
          {futureAppointments.length > futurePreview.length && (
            <p className="mt-3 text-sm text-muted">
              Showing {futurePreview.length} of {futureAppointments.length}. The rest are on Upcoming appointments.
            </p>
          )}
        </section>

        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          <PlaceholderCard
            title="Clinic Overview"
            description="A summary of clinic activity will appear here."
          />
          <PlaceholderCard title="Revenue" description="Sales and revenue summaries will appear here." />
          <PlaceholderCard
            title="Inventory Alerts"
            description="Low-stock and expiring items will appear here."
          />
          <PlaceholderCard title="Analytics" description="Complete clinic analytics will appear here." />
          <PlaceholderCard title="User Management" description="Manage client and staff accounts here." />
          <section className={panelPaddingClass()}>
            <h2 className="text-base font-semibold text-ink">Clinical Records</h2>
            <p className="mt-3 text-sm text-muted">
              Official clinical notes, vaccinations, and weight history are kept on each pet.
            </p>
            <Link href="/staff/clients" className="mt-4 inline-block text-sm font-semibold text-brand hover:underline">
              Open client and pet records
            </Link>
          </section>
        </div>
      </div>
    </>
  );
}
