import type { Metadata } from "next";
import Link from "next/link";
import { AppointmentCard } from "@/components/appointments/AppointmentCard";
import { DashboardHeading } from "@/components/portal/PlaceholderCard";
import { buttonClass } from "@/components/ui/button-styles";
import { FormField } from "@/components/ui/FormField";
import { Alert } from "@/components/ui/Alert";
import { listAppointmentsForDay } from "@/lib/appointments/server";
import { requireRole } from "@/lib/auth/session";
import { todayIso } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Appointments" };

export default async function StaffAppointmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ day?: string; q?: string; source?: string; completeError?: string; completed?: string }>;
}) {
  await requireRole(["STAFF", "SENIOR_VET"]);
  const params = await searchParams;
  const day = params.day && /^\d{4}-\d{2}-\d{2}$/.test(params.day) ? params.day : todayIso();
  const supabase = await createClient();
  const appointments = await listAppointmentsForDay(supabase, day, {
    q: params.q,
    source: params.source,
  });

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <DashboardHeading title="Appointment schedule" subtitle={`Day view for ${day}.`} />
        <div className="flex flex-wrap gap-2">
          <Link href="/staff/appointments/new" className={buttonClass("primary", "md")}>
            Walk-in / book
          </Link>
          <Link href="/staff/appointments/slots" className={buttonClass("outline", "md")}>
            Manage slots
          </Link>
        </div>
      </div>

      {params.completed === "1" && (
        <Alert variant="success" >
          Appointment marked as completed.
        </Alert>
      )}
      {params.completeError && (
        <Alert variant="error">{params.completeError}</Alert>
      )}

      <form method="get" className="mt-6 flex flex-wrap items-end gap-3">
        <FormField label="Date" name="day" type="date" defaultValue={day} className="w-auto" />
        <FormField label="Search" name="q" type="search" defaultValue={params.q ?? ""} className="min-w-[12rem]" />
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-800">Source</label>
          <select
            name="source"
            defaultValue={params.source ?? ""}
            className="min-h-11 rounded-lg border border-slate-300 px-3 text-sm"
          >
            <option value="">All</option>
            <option value="APPOINTMENT">Appointment</option>
            <option value="WALK_IN">Walk-in</option>
          </select>
        </div>
        <button type="submit" className={buttonClass("secondary", "md")}>
          Filter
        </button>
      </form>

      <ul className="mt-8 space-y-3">
        {appointments.length === 0 ? (
          <li className="text-sm text-slate-600">No appointments for this day.</li>
        ) : (
          appointments.map((a) => (
            <li key={a.id}>
              <AppointmentCard
                appointment={a}
                href="/staff/appointments"
                showClient
                showMarkComplete
                staffDay={day}
              />
            </li>
          ))
        )}
      </ul>
    </>
  );
}
