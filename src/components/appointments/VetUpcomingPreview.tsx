import { AppointmentStatusBadge } from "@/components/appointments/AppointmentStatusBadge";
import { formatTime12, SOURCE_LABELS, type AppointmentListRow } from "@/lib/appointments/constants";
import { formatDate } from "@/lib/dates";

export function VetUpcomingPreview({
  appointments,
}: {
  appointments: (AppointmentListRow & { client?: { full_name: string } })[];
}) {
  if (appointments.length === 0) {
    return <p className="text-sm text-slate-600">No upcoming appointments assigned to you.</p>;
  }

  return (
    <ul className="mt-4 space-y-3">
      {appointments.map((a) => (
        <li
          key={a.id}
          className="rounded-lg border border-slate-100 px-3 py-3 text-sm"
        >
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="font-medium text-slate-900">
                {formatDate(a.slot.slot_date)} · {formatTime12(a.slot.start_time)}
              </p>
              <p className="mt-1 text-slate-600">
                {a.client?.full_name ?? "Client"} · {a.pet.name} · {a.service.name}
              </p>
              <p className="mt-1 text-xs text-slate-500">{SOURCE_LABELS[a.source]}</p>
            </div>
            <AppointmentStatusBadge status={a.status} />
          </div>
        </li>
      ))}
    </ul>
  );
}
