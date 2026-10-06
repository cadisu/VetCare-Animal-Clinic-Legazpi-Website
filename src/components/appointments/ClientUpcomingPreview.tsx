import Link from "next/link";
import { formatTime12, type AppointmentListRow } from "@/lib/appointments/constants";
import { formatDate } from "@/lib/dates";

export function ClientUpcomingPreview({
  appointments,
  detailHref,
}: {
  appointments: AppointmentListRow[];
  detailHref: (id: string) => string;
}) {
  if (appointments.length === 0) {
    return <p className="text-sm text-slate-600">No upcoming appointments.</p>;
  }

  return (
    <ul className="mt-4 space-y-3">
      {appointments.map((a) => (
        <li key={a.id}>
          <Link
            href={detailHref(a.id)}
            className="block rounded-lg border border-slate-100 px-3 py-2 text-sm hover:border-brand/30 hover:bg-brand-soft/30"
          >
            <span className="font-medium text-slate-900">
              {formatDate(a.slot.slot_date)} — {formatTime12(a.slot.start_time)} — {a.service.name}
            </span>
            {a.slot.veterinarian && (
              <span className="mt-0.5 block text-slate-600">{a.slot.veterinarian.display_name}</span>
            )}
            {a.slot.requires_vet_acceptance && a.status === "PENDING" && (
              <span className="mt-1 block text-xs text-amber-800">Awaiting veterinarian confirmation</span>
            )}
          </Link>
        </li>
      ))}
    </ul>
  );
}
