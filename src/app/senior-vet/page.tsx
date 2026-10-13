import type { Metadata } from "next";
import Link from "next/link";
import { AppointmentCard } from "@/components/appointments/AppointmentCard";
import { DashboardHeading, PlaceholderCard } from "@/components/portal/PlaceholderCard";
import { CLIENT_UPCOMING_PREVIEW_LIMIT } from "@/lib/appointments/constants";
import { listAppointmentsForDay, listFutureClinicAppointments } from "@/lib/appointments/server";
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
  let loadError = false;
  try {
    [todayAppointments, futureAppointments] = await Promise.all([
      listAppointmentsForDay(supabase, today),
      listFutureClinicAppointments(supabase),
    ]);
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
        <section className="rounded-2xl border border-slate-200 bg-white p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold">Today&apos;s Appointments</h2>
              <p className="mt-1 text-sm text-slate-600">
                {todayAppointments.length === 0
                  ? "No appointments for today."
                  : `${todayAppointments.length} scheduled for today.`}
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
                  <AppointmentCard appointment={appointment} href="/senior-vet/appointments" showClient />
                </li>
              ))}
            </ul>
          )}
          {todayAppointments.length > todayPreview.length && (
            <p className="mt-3 text-sm text-slate-600">
              Showing {todayPreview.length} of {todayAppointments.length}. The rest are on the full Today view.
            </p>
          )}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold">Future Appointments</h2>
              <p className="mt-1 text-sm text-slate-600">Upcoming visits after today, nearest first.</p>
            </div>
            <Link
              href="/senior-vet/appointments/future"
              className="text-sm font-semibold text-brand hover:underline"
            >
              View all
            </Link>
          </div>
          {futurePreview.length === 0 ? (
            <p className="mt-4 text-sm text-slate-600">No upcoming appointments after today.</p>
          ) : (
            <ul className="mt-4 space-y-2">
              {futurePreview.map((appointment) => (
                <li key={appointment.id}>
                  <AppointmentCard appointment={appointment} href="/senior-vet/appointments/future" showClient />
                </li>
              ))}
            </ul>
          )}
          {futureAppointments.length > futurePreview.length && (
            <p className="mt-3 text-sm text-slate-600">
              Showing {futurePreview.length} of {futureAppointments.length}. The rest are on the full Future view.
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
          <PlaceholderCard
            title="Clinical Records"
            description="Official clinical and vaccination records will be managed here."
          />
        </div>
      </div>
    </>
  );
}
