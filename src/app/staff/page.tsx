import type { Metadata } from "next";
import Link from "next/link";
import { AppointmentCard } from "@/components/appointments/AppointmentCard";
import { DashboardHeading, PlaceholderCard } from "@/components/portal/PlaceholderCard";
import { buttonClass } from "@/components/ui/button-styles";
import { listAppointmentsForDay } from "@/lib/appointments/server";
import { requireRole } from "@/lib/auth/session";
import { todayIso } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Staff Dashboard" };

export default async function StaffDashboardPage() {
  const profile = await requireRole(["STAFF", "SENIOR_VET"]);
  const firstName = profile.first_name || "team";
  const today = todayIso();
  const supabase = await createClient();
  const todayAppointments = await listAppointmentsForDay(supabase, today);
  const walkIns = todayAppointments.filter((a) => a.source === "WALK_IN");

  return (
    <>
      <DashboardHeading
        title={`Welcome, ${firstName}!`}
        subtitle="Today's clinic operations at a glance."
      />
      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 xl:col-span-2">
          <div className="flex items-start justify-between gap-3">
            <h2 className="text-base font-semibold">Today&apos;s Appointments ({todayAppointments.length})</h2>
            <Link href={`/staff/appointments?day=${today}`} className="text-sm font-semibold text-brand hover:underline">
              Open schedule
            </Link>
          </div>
          <ul className="mt-4 space-y-2">
            {todayAppointments.slice(0, 5).map((a) => (
              <li key={a.id}>
                <AppointmentCard appointment={a} href={`/staff/appointments?day=${today}`} showClient />
              </li>
            ))}
            {todayAppointments.length === 0 && (
              <p className="text-sm text-slate-600">No appointments scheduled for today yet.</p>
            )}
          </ul>
        </section>
        <section className="rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="text-base font-semibold">Walk-ins today ({walkIns.length})</h2>
          <p className="mt-2 text-sm text-slate-600">Register walk-ins for existing clients and pets.</p>
          <Link href="/staff/appointments/new?source=WALK_IN" className={buttonClass("primary", "md", "mt-4 inline-flex")}>
            New walk-in
          </Link>
        </section>
        <Link
          href="/staff/clients"
          className="rounded-2xl border border-slate-200 bg-white p-6 transition-colors hover:border-brand/40 hover:bg-brand-soft/40"
        >
          <h2 className="text-base font-semibold text-slate-900">Clients</h2>
          <p className="mt-3 text-sm text-slate-600">Search clients and view their pets.</p>
          <p className="mt-4 text-sm font-semibold text-brand">Open clients →</p>
        </Link>
        <PlaceholderCard title="POS" description="Point-of-sale checkout will be available here." />
        <PlaceholderCard
          title="Inventory"
          description="Stock levels and inventory alerts will appear here."
        />
        <PlaceholderCard
          title="Analytics"
          description="Operational analytics will appear here."
        />
      </div>
    </>
  );
}
