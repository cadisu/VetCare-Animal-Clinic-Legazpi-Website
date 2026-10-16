import type { Metadata } from "next";
import { AppointmentCard } from "@/components/appointments/AppointmentCard";
import { AppointmentStatusNotice } from "@/components/appointments/AppointmentStatusNotice";
import { Alert } from "@/components/ui/Alert";
import { listFutureClinicAppointments } from "@/lib/appointments/server";
import { requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Future Appointments" };

export default async function SeniorVetFutureAppointmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string; statusError?: string; completed?: string }>;
}) {
  await requireRole(["SENIOR_VET"]);
  const params = await searchParams;
  const supabase = await createClient();

  let appointments: Awaited<ReturnType<typeof listFutureClinicAppointments>> = [];
  let loadError = false;
  try {
    appointments = await listFutureClinicAppointments(supabase);
  } catch {
    loadError = true;
  }

  return (
    <>
      <h2 className="text-lg font-semibold text-slate-900">Future Appointments</h2>
      <p className="mt-1 text-sm text-slate-600">Upcoming visits after today, nearest first.</p>

      <AppointmentStatusNotice notice={params.notice} statusError={params.statusError} completed={params.completed} />
      {loadError && (
        <div className="mt-4">
          <Alert variant="error">Future appointments could not be loaded. Refresh the page to try again.</Alert>
        </div>
      )}

      <ul className="mt-8 space-y-3">
        {!loadError && appointments.length === 0 ? (
          <li className="text-sm text-slate-600">No upcoming appointments after today.</li>
        ) : (
          appointments.map((appointment) => (
            <li key={appointment.id}>
              <AppointmentCard
                appointment={appointment}
                href={`/staff/appointments/${appointment.id}`}
                showClient
                showStatusActions
                actorRole="SENIOR_VET"
                returnTo="/senior-vet/appointments/future"
              />
            </li>
          ))
        )}
      </ul>
    </>
  );
}
