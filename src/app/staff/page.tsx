import type { Metadata } from "next";
import Link from "next/link";
import { AppointmentCard } from "@/components/appointments/AppointmentCard";
import { AppointmentStatusNotice } from "@/components/appointments/AppointmentStatusNotice";
import { FlashNotice } from "@/components/appointments/FlashNotice";
import { DashboardHeading } from "@/components/portal/PlaceholderCard";
import { InventoryAlertCard } from "@/components/inventory/InventoryAlertCard";
import { buttonClass } from "@/components/ui/button-styles";
import { panelClass, panelPaddingClass } from "@/components/ui/panel-styles";
import { CLIENT_UPCOMING_PREVIEW_LIMIT } from "@/lib/appointments/constants";
import { listAppointmentsForDay, listFutureClinicAppointments } from "@/lib/appointments/server";
import { requireRole } from "@/lib/auth/session";
import { todayIso } from "@/lib/dates";
import { listInventoryAlerts } from "@/lib/inventory/server";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Staff Dashboard" };

export default async function StaffDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ flash?: string; flashError?: string; notice?: string; statusError?: string }>;
}) {
  const profile = await requireRole(["STAFF", "SENIOR_VET"]);
  const query = await searchParams;
  const firstName = profile.first_name || "team";
  const today = todayIso();
  const supabase = await createClient();
  const alerts = await listInventoryAlerts(supabase);
  const actorRole = profile.role === "SENIOR_VET" ? "SENIOR_VET" : "STAFF";
  let todayAppointments: Awaited<ReturnType<typeof listAppointmentsForDay>> = [];
  let futureAppointments: Awaited<ReturnType<typeof listFutureClinicAppointments>> = [];
  try {
    [todayAppointments, futureAppointments] = await Promise.all([
      listAppointmentsForDay(supabase, today),
      listFutureClinicAppointments(supabase),
    ]);
  } catch {
    todayAppointments = [];
    futureAppointments = [];
  }
  const walkIns = todayAppointments.filter((a) => a.source === "WALK_IN");
  const futurePreview = futureAppointments.slice(0, CLIENT_UPCOMING_PREVIEW_LIMIT);

  return (
    <>
      <DashboardHeading title={`Welcome, ${firstName}!`} />
      <AppointmentStatusNotice notice={query.notice} statusError={query.statusError} />
      <FlashNotice flash={query.flash} flashError={query.flashError} />
      <div className="space-y-6">
        <div className="grid gap-6 lg:grid-cols-2">
        <section className={panelPaddingClass()}>
          <div className="flex items-start justify-between gap-3">
            <h2 className="text-base font-semibold text-ink">Today&apos;s Appointments ({todayAppointments.length})</h2>
            <Link href={`/staff/appointments?day=${today}`} className="text-sm font-semibold text-brand hover:underline">
              Open schedule
            </Link>
          </div>
          {todayAppointments.length === 0 ? (
            <p className="mt-4 text-sm text-muted">No appointments scheduled for today yet.</p>
          ) : (
            <ul className="mt-4 space-y-2">
              {todayAppointments.slice(0, CLIENT_UPCOMING_PREVIEW_LIMIT).map((a) => (
                <li key={a.id}>
                  <AppointmentCard
                    appointment={a}
                    href={`/staff/appointments/${a.id}`}
                    showClient
                    showStaffActions
                    showStatusActions
                    actorRole={actorRole}
                    staffDay={today}
                    returnTo="/staff"
                  />
                </li>
              ))}
            </ul>
          )}
          {todayAppointments.length > CLIENT_UPCOMING_PREVIEW_LIMIT && (
            <p className="mt-3 text-sm text-muted">
              Showing {CLIENT_UPCOMING_PREVIEW_LIMIT} of {todayAppointments.length}. The rest are on the schedule.
            </p>
          )}
        </section>
        <section className={panelPaddingClass()}>
          <div className="flex items-start justify-between gap-3">
            <h2 className="text-base font-semibold text-ink">Upcoming appointments</h2>
            <Link href="/staff/appointments/upcoming" className="text-sm font-semibold text-brand hover:underline">
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
                    href={`/staff/appointments/${appointment.id}`}
                    showClient
                    showStaffActions
                    showStatusActions
                    actorRole={actorRole}
                    returnTo="/staff"
                  />
                </li>
              ))}
            </ul>
          )}
          {futureAppointments.length > futurePreview.length && (
            <p className="mt-3 text-sm text-muted">
              Showing {futurePreview.length} of {futureAppointments.length}. The rest are on the Upcoming list.
            </p>
          )}
        </section>
        </div>
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        <section className={panelPaddingClass()}>
          <h2 className="text-base font-semibold text-ink">Walk-ins today ({walkIns.length})</h2>
          <Link href="/staff/appointments/new?source=WALK_IN" className={buttonClass("primary", "md", "mt-4 inline-flex")}>
            New walk-in
          </Link>
        </section>
        <Link
          href="/staff/clients"
          className={panelClass("p-6 transition-colors hover:border-brand/40 hover:bg-highlight/80")}
        >
          <h2 className="text-base font-semibold text-ink">Clients</h2>
          <p className="mt-4 text-sm font-semibold text-brand">Open clients →</p>
        </Link>
        <Link
          href="/staff/pos"
          className={panelClass("p-6 transition-colors hover:border-brand/40 hover:bg-highlight/80")}
        >
          <h2 className="text-base font-semibold text-ink">POS</h2>
          <p className="mt-4 text-sm font-semibold text-brand">Open POS →</p>
        </Link>
        <InventoryAlertCard alerts={alerts} />
        <Link
          href="/staff/analytics"
          className={panelClass("p-6 transition-colors hover:border-brand/40 hover:bg-highlight/80")}
        >
          <h2 className="text-base font-semibold text-ink">Analytics</h2>
          <p className="mt-4 text-sm font-semibold text-brand">Open analytics →</p>
        </Link>
        </div>
      </div>
    </>
  );
}
