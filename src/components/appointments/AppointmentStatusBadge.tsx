import { isAppointmentStatus, statusLabel, type AppointmentStatus } from "@/lib/appointments/constants";

const STYLES: Record<AppointmentStatus, string> = {
  PENDING: "bg-amber-50 text-amber-800 ring-amber-200",
  CONFIRMED: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  CHECKED_IN: "bg-sky-50 text-sky-800 ring-sky-200",
  IN_CONSULTATION: "bg-violet-50 text-violet-800 ring-violet-200",
  COMPLETED: "bg-slate-100 text-slate-700 ring-slate-200",
  CANCELLED: "bg-red-50 text-red-700 ring-red-200",
  NO_SHOW: "bg-orange-50 text-orange-800 ring-orange-200",
};

const UNKNOWN_STYLE = "bg-slate-100 text-slate-700 ring-slate-200";

export function AppointmentStatusBadge({ status }: { status: string }) {
  const style = isAppointmentStatus(status) ? STYLES[status] : UNKNOWN_STYLE;
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${style}`}>
      {statusLabel(status)}
    </span>
  );
}
