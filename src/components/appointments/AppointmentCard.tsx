import Link from "next/link";
import { sendAppointmentReminderNowAction } from "@/app/actions/sms";
import { AppointmentStatusActions } from "@/components/appointments/AppointmentStatusActions";
import { AppointmentStatusBadge } from "@/components/appointments/AppointmentStatusBadge";
import { buttonClass } from "@/components/ui/button-styles";
import { ConfirmSubmitButton } from "@/components/ui/ConfirmSubmitButton";
import { panelClass } from "@/components/ui/panel-styles";
import { formatDate } from "@/lib/dates";
import {
  appointmentSlotStartMs,
  formatTime12,
  SOURCE_LABELS,
  type AppointmentListRow,
  type ScheduleRecordMark,
} from "@/lib/appointments/constants";

const RECORD_BORDER: Record<ScheduleRecordMark, string> = {
  pending: "border-2 !border-yellow-400",
  recorded: "border-2 !border-green-600",
  closed: "border-2 !border-red-600",
};

function canSendReminder(appointment: AppointmentListRow): boolean {
  return (
    (appointment.status === "PENDING" || appointment.status === "CONFIRMED") &&
    appointmentSlotStartMs(appointment.slot.slot_date, appointment.slot.start_time) > Date.now()
  );
}

export function AppointmentCard({
  appointment,
  href,
  showClient,
  staffDay,
  showStatusActions,
  showStaffActions,
  actorRole,
  returnTo,
  detailsHref,
  recordMark,
}: {
  appointment: AppointmentListRow & { client?: { full_name: string } };
  href: string;
  showClient?: boolean;
  staffDay?: string;
  showStatusActions?: boolean;
  showStaffActions?: boolean;
  actorRole?: "STAFF" | "SENIOR_VET";
  returnTo?: string;
  detailsHref?: string;
  recordMark?: ScheduleRecordMark | null;
}) {
  const { slot } = appointment;
  const summary = (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <p className="text-sm font-semibold text-ink">{appointment.service.name}</p>
        <p className="mt-1 text-sm text-muted">
          {appointment.pet.name} · {formatDate(slot.slot_date)} at {formatTime12(slot.start_time)}
        </p>
        {slot.veterinarian && <p className="mt-1 text-xs text-muted">{slot.veterinarian.display_name}</p>}
        {showClient && appointment.client && (
          <p className="mt-1 text-xs text-muted">Client: {appointment.client.full_name}</p>
        )}
      </div>
      <div className="flex flex-col items-end gap-2">
        <AppointmentStatusBadge status={appointment.status} />
        <span className="text-xs text-muted">{SOURCE_LABELS[appointment.source]}</span>
      </div>
    </div>
  );

  return (
    <div className={panelClass(`p-5${recordMark ? ` ${RECORD_BORDER[recordMark]}` : ""}`)}>
      {showStaffActions ? (
        summary
      ) : (
        <Link href={href} className="block transition-colors hover:text-brand">
          {summary}
        </Link>
      )}
      {slot.requires_vet_acceptance && appointment.status === "PENDING" && (
        <p className="mt-3 text-xs font-medium text-amber-800">
          Confirmation is required before this visit can be checked in.
        </p>
      )}
      {showStaffActions && (
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href={detailsHref ?? `/staff/appointments/${appointment.id}`} className={buttonClass("outline", "md")}>
            View details
          </Link>
          {actorRole === "SENIOR_VET" &&
            (appointment.status === "IN_CONSULTATION" || appointment.status === "COMPLETED") && (
              <Link href={`${detailsHref ?? href}#visit-record`} className={buttonClass("primary", "md")}>
                Record visit
              </Link>
            )}
          {canSendReminder(appointment) && (
            <form action={sendAppointmentReminderNowAction}>
              <input type="hidden" name="appointmentId" value={appointment.id} />
              {returnTo && <input type="hidden" name="returnTo" value={returnTo} />}
              <ConfirmSubmitButton
                variant="primary"
                confirmMessage="Send the appointment reminder now? This uses SMS credits."
                pendingText="Sending..."
              >
                Send Appointment Reminder
              </ConfirmSubmitButton>
            </form>
          )}
        </div>
      )}
      {showStatusActions && actorRole && (
        <AppointmentStatusActions
          role={actorRole}
          appointmentId={appointment.id}
          status={appointment.status}
          slotDate={slot.slot_date}
          day={staffDay}
          returnTo={returnTo}
          petName={appointment.pet.name}
        />
      )}
    </div>
  );
}
