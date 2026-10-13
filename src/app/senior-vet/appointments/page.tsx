import type { Metadata } from "next";
import { AppointmentCard } from "@/components/appointments/AppointmentCard";
import { Alert } from "@/components/ui/Alert";
import { buttonClass } from "@/components/ui/button-styles";
import { FormField } from "@/components/ui/FormField";
import { listAppointmentsForDay } from "@/lib/appointments/server";
import { requireRole } from "@/lib/auth/session";
import { todayIso } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Today's Appointments" };

export default async function SeniorVetTodayAppointmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ day?: string; q?: string; source?: string; completeError?: string; completed?: string }>;
}) {
  await requireRole(["SENIOR_VET"]);
  const params = await searchParams;
  const day = params.day && /^\d{4}-\d{2}-\d{2}$/.test(params.day) ? params.day : todayIso();
  const supabase = await createClient();
  const appointments = await listAppointmentsForDay(supabase, day, {
    q: params.q,
    source: params.source,
  });

  return (
    <>
      <h2 className="text-lg font-semibold text-slate-900">Today&apos;s Appointments</h2>
      <p className="mt-1 text-sm text-slate-600">Day view for {day}.</p>

      {params.completed === "1" && (
        <div className="mt-4">
          <Alert variant="success">Appointment marked as completed.</Alert>
        </div>
      )}
      {params.completeError && (
        <div className="mt-4">
          <Alert variant="error">{params.completeError}</Alert>
        </div>
      )}

      <form method="get" className="mt-6 flex flex-wrap items-end gap-3">
        <FormField label="Date" name="day" type="date" defaultValue={day} className="w-auto" />
        <FormField label="Search" name="q" type="search" defaultValue={params.q ?? ""} className="min-w-[12rem]" />
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-800" htmlFor="source">
            Source
          </label>
          <select
            id="source"
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
          appointments.map((appointment) => (
            <li key={appointment.id}>
              <AppointmentCard
                appointment={appointment}
                href="/senior-vet/appointments"
                showClient
                showMarkComplete
                staffDay={day}
                returnTo="/senior-vet/appointments"
              />
            </li>
          ))
        )}
      </ul>
    </>
  );
}
