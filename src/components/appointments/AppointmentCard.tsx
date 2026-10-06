import Link from "next/link";
import { AppointmentStatusBadge } from "@/components/appointments/AppointmentStatusBadge";
import { MarkCompleteButton } from "@/components/appointments/MarkCompleteButton";
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
  showMarkComplete,
}: {
  appointment: AppointmentListRow & { client?: { full_name: string } };
  href: string;
  showClient?: boolean;
  staffDay?: string;
  showMarkComplete?: boolean;
}) {
  const { slot } = appointment;
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <Link
        href={href}
        className="block transition-colors hover:text-brand"
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-slate-900">{appointment.service.name}</p>
            <p className="mt-1 text-sm text-slate-600">
              {appointment.pet.name} · {formatDate(slot.slot_date)} at {formatTime12(slot.start_time)}
            </p>
            {slot.veterinarian && (
              <p className="mt-1 text-xs text-slate-500">{slot.veterinarian.display_name}</p>
            )}
            {showClient && appointment.client && (
              <p className="mt-1 text-xs text-slate-500">Client: {appointment.client.full_name}</p>
            )}
          </div>
          <div className="flex flex-col items-end gap-2">
            <AppointmentStatusBadge status={appointment.status} />
            <span className="text-xs text-slate-500">{SOURCE_LABELS[appointment.source]}</span>
          </div>
        </div>
        {slot.requires_vet_acceptance && appointment.status === "PENDING" && (
          <p className="mt-3 text-xs font-medium text-amber-800">
            Awaiting veterinarian confirmation (Phase 4 will add the accept action).
          </p>
        )}
      </Link>
      {showMarkComplete && <MarkCompleteButton appointment={appointment} day={staffDay} />}
    </div>
  );
}
