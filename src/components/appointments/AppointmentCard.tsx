import Link from "next/link";
import { AppointmentStatusActions } from "@/components/appointments/AppointmentStatusActions";
import { AppointmentStatusBadge } from "@/components/appointments/AppointmentStatusBadge";
import { panelClass } from "@/components/ui/panel-styles";
import { formatDate } from "@/lib/dates";
import {
  formatTime12,
  SOURCE_LABELS,
  type AppointmentListRow,
} from "@/lib/appointments/constants";

export function AppointmentCard({
  appointment,
  href,
  showClient,
  staffDay,
  showStatusActions,
  actorRole,
  returnTo,
}: {
  appointment: AppointmentListRow & { client?: { full_name: string } };
  href: string;
  showClient?: boolean;
  staffDay?: string;
  showStatusActions?: boolean;
  actorRole?: "STAFF" | "SENIOR_VET";
  returnTo?: string;
}) {
  const { slot } = appointment;
  return (
    <div className={panelClass("p-5")}>
      <Link
        href={href}
        className="block transition-colors hover:text-brand"
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-ink">{appointment.service.name}</p>
            <p className="mt-1 text-sm text-muted">
              {appointment.pet.name} · {formatDate(slot.slot_date)} at {formatTime12(slot.start_time)}
            </p>
            {slot.veterinarian && (
              <p className="mt-1 text-xs text-muted">{slot.veterinarian.display_name}</p>
            )}
            {showClient && appointment.client && (
              <p className="mt-1 text-xs text-muted">Client: {appointment.client.full_name}</p>
            )}
          </div>
          <div className="flex flex-col items-end gap-2">
            <AppointmentStatusBadge status={appointment.status} />
            <span className="text-xs text-muted">{SOURCE_LABELS[appointment.source]}</span>
          </div>
        </div>
        {slot.requires_vet_acceptance && appointment.status === "PENDING" && (
          <p className="mt-3 text-xs font-medium text-amber-800">
            Confirmation is required before this visit can be checked in.
          </p>
        )}
      </Link>
      {showStatusActions && actorRole && (
        <AppointmentStatusActions
          role={actorRole}
          appointmentId={appointment.id}
          status={appointment.status}
          day={staffDay}
          returnTo={returnTo}
        />
      )}
    </div>
  );
}
