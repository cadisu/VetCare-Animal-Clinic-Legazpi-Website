import { AppointmentStatusBadge } from "@/components/appointments/AppointmentStatusBadge";
import { Alert } from "@/components/ui/Alert";
import { formatTime12, SOURCE_LABELS, type AppointmentListRow } from "@/lib/appointments/constants";
import { formatDate } from "@/lib/dates";

export function StaffAppointmentCreatedNotice({
  appointment,
}: {
  appointment: AppointmentListRow & { client?: { full_name: string } };
}) {
  const { slot } = appointment;
  const clientName = appointment.client?.full_name ?? "Client";
  const vetAcceptancePending = slot.requires_vet_acceptance && appointment.status === "PENDING";

  return (
    <div className="mt-4 space-y-3">
      <Alert variant="success">
        Appointment created for {clientName} — {appointment.pet.name}, {appointment.service.name},{" "}
        {formatDate(slot.slot_date)} at {formatTime12(slot.start_time)} ({SOURCE_LABELS[appointment.source]}
        ).
      </Alert>
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50/50 px-4 py-3 text-sm text-emerald-900">
        <span className="font-medium">Status:</span>
        <AppointmentStatusBadge status={appointment.status} />
      </div>
      {vetAcceptancePending && (
        <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-900">
          This slot requires veterinarian confirmation. Confirm the appointment from the schedule when
          the visit is accepted.
        </p>
      )}
      <p className="text-sm text-muted">The new visit appears in the list below.</p>
    </div>
  );
}
