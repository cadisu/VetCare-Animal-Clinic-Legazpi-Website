import type { Metadata } from "next";
import Link from "next/link";
import { AppointmentCard } from "@/components/appointments/AppointmentCard";
import { DashboardHeading, PlaceholderCard } from "@/components/portal/PlaceholderCard";
import { VetUpcomingPreview } from "@/components/appointments/VetUpcomingPreview";
import {
  getVeterinarianIdForProfile,
  listAppointmentsForDay,
  listUpcomingAppointmentsForVeterinarianProfile,
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
  const [todayAppointments, veterinarianId, myUpcoming] = await Promise.all([
    listAppointmentsForDay(supabase, today),
    getVeterinarianIdForProfile(supabase, profile.id),
    listUpcomingAppointmentsForVeterinarianProfile(supabase, profile.id),
  ]);

  return (
    <>
      <DashboardHeading
        title={`Welcome, ${firstName}!`}
        subtitle="Clinical and administrative overview of the clinic."
      />
      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 xl:col-span-2">
          <div className="flex items-start justify-between gap-3">
            <h2 className="text-base font-semibold">Today&apos;s Appointments</h2>
            <Link href={`/staff/appointments?day=${today}`} className="text-sm font-semibold text-brand hover:underline">
              Full schedule
            </Link>
          </div>
          <ul className="mt-4 space-y-2">
            {todayAppointments.slice(0, 5).map((a) => (
              <li key={a.id}>
                <AppointmentCard appointment={a} href={`/staff/appointments?day=${today}`} showClient />
              </li>
            ))}
            {todayAppointments.length === 0 && (
              <p className="text-sm text-slate-600">No appointments for today.</p>
            )}
          </ul>
        </section>
        <section className="rounded-2xl border border-slate-200 bg-white p-6 xl:col-span-2">
          <h2 className="text-base font-semibold">My upcoming appointments</h2>
          <p className="mt-1 text-sm text-slate-600">
            Visits where you are the selected veterinarian (including future dates).
          </p>
          {!veterinarianId && (
            <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              Your login is not linked to a veterinarian record, so assigned visits cannot be listed here.
              Ask an administrator to run{" "}
              <code className="text-xs">create-privileged-user</code> with{" "}
              <code className="text-xs">--veterinarian-id</code> for your account.
            </p>
          )}
          <VetUpcomingPreview appointments={myUpcoming} />
        </section>
        <PlaceholderCard
          title="Clinic Overview"
          description="A summary of clinic activity will appear here."
        />
        <PlaceholderCard
          title="Revenue"
          description="Sales and revenue summaries will appear here."
        />
        <PlaceholderCard
          title="Inventory Alerts"
          description="Low-stock and expiring items will appear here."
        />
        <PlaceholderCard
          title="Analytics"
          description="Complete clinic analytics will appear here."
        />
        <PlaceholderCard
          title="User Management"
          description="Manage client and staff accounts here."
        />
        <PlaceholderCard
          title="Clinical Records"
          description="Official clinical and vaccination records will be managed here."
        />
      </div>
    </>
  );
}
