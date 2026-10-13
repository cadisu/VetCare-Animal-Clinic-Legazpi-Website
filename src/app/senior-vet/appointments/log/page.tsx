import type { Metadata } from "next";
import Link from "next/link";
import { AppointmentStatusBadge } from "@/components/appointments/AppointmentStatusBadge";
import { Alert } from "@/components/ui/Alert";
import { buttonClass } from "@/components/ui/button-styles";
import { FormField } from "@/components/ui/FormField";
import {
  APPOINTMENT_LOG_PAGE_SIZE,
  listAppointmentLog,
  type AppointmentLogResult,
} from "@/lib/appointments/server";
import { APPOINTMENT_STATUSES, STATUS_LABELS, formatTime12 } from "@/lib/appointments/constants";
import { requireRole } from "@/lib/auth/session";
import { formatDate } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Appointment Log" };

function formatCreated(value: string): string {
  return new Intl.DateTimeFormat("en-PH", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function logHref(
  filters: { q?: string; status?: string; from?: string; to?: string },
  page: number,
): string {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (filters.status) params.set("status", filters.status);
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  if (page > 1) params.set("page", String(page));
  const query = params.toString();
  return query ? `/senior-vet/appointments/log?${query}` : "/senior-vet/appointments/log";
}

export default async function SeniorVetAppointmentLogPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string; status?: string; from?: string; to?: string }>;
}) {
  await requireRole(["SENIOR_VET"]);
  const params = await searchParams;
  const page = Number(params.page);
  const filters = {
    page: Number.isFinite(page) ? page : 1,
    q: params.q,
    status: params.status,
    from: params.from,
    to: params.to,
  };

  const supabase = await createClient();
  let result: AppointmentLogResult | null = null;
  let loadError = false;
  try {
    result = await listAppointmentLog(supabase, filters);
  } catch {
    loadError = true;
  }

  const totalPages = result ? Math.max(1, Math.ceil(result.total / APPOINTMENT_LOG_PAGE_SIZE)) : 1;
  const currentPage = result?.page ?? 1;

  return (
    <>
      <h2 className="text-lg font-semibold text-slate-900">Appointment Log</h2>
      <p className="mt-1 text-sm text-slate-600">
        Every recorded appointment, including completed and cancelled visits.
      </p>

      {loadError && (
        <div className="mt-4">
          <Alert variant="error">The appointment log could not be loaded. Refresh the page to try again.</Alert>
        </div>
      )}
      {result?.truncated && (
        <div className="mt-4">
          <Alert variant="info">
            This view is limited to the most recent matching records. Narrow the date range to look further back.
          </Alert>
        </div>
      )}

      <form method="get" className="mt-6 flex flex-wrap items-end gap-3">
        <FormField label="Search" name="q" type="search" defaultValue={params.q ?? ""} className="min-w-[12rem]" />
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-800" htmlFor="status">
            Status
          </label>
          <select
            id="status"
            name="status"
            defaultValue={params.status ?? ""}
            className="min-h-11 rounded-lg border border-slate-300 px-3 text-sm"
          >
            <option value="">All</option>
            {APPOINTMENT_STATUSES.map((status) => (
              <option key={status} value={status}>
                {STATUS_LABELS[status]}
              </option>
            ))}
          </select>
        </div>
        <FormField label="From" name="from" type="date" defaultValue={params.from ?? ""} className="w-auto" />
        <FormField label="To" name="to" type="date" defaultValue={params.to ?? ""} className="w-auto" />
        <button type="submit" className={buttonClass("secondary", "md")}>
          Filter
        </button>
      </form>

      {!loadError && result && result.rows.length === 0 && (
        <p className="mt-8 text-sm text-slate-600">No appointments match these filters.</p>
      )}

      {result && result.rows.length > 0 && (
        <>
          <div className="mt-6 overflow-x-auto rounded-2xl border border-slate-200 bg-white">
            <table className="min-w-[56rem] w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3 font-medium">Time</th>
                  <th className="px-4 py-3 font-medium">Client</th>
                  <th className="px-4 py-3 font-medium">Pet</th>
                  <th className="px-4 py-3 font-medium">Service</th>
                  <th className="px-4 py-3 font-medium">Veterinarian</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Created</th>
                  <th className="px-4 py-3 font-medium">Details</th>
                </tr>
              </thead>
              <tbody>
                {result.rows.map((appointment) => (
                  <tr key={appointment.id} className="border-b border-slate-100 last:border-0">
                    <td className="px-4 py-3 whitespace-nowrap">{formatDate(appointment.slot.slot_date)}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{formatTime12(appointment.slot.start_time)}</td>
                    <td className="px-4 py-3">{appointment.client?.full_name || "—"}</td>
                    <td className="px-4 py-3">{appointment.pet.name}</td>
                    <td className="px-4 py-3">{appointment.service.name}</td>
                    <td className="px-4 py-3">{appointment.slot.veterinarian?.display_name || "—"}</td>
                    <td className="px-4 py-3">
                      <AppointmentStatusBadge status={appointment.status} />
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">{formatCreated(appointment.created_at)}</td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/staff/appointments?day=${appointment.slot.slot_date}`}
                        className="font-semibold text-brand hover:underline"
                      >
                        View day
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-600">
            <p>
              Page {currentPage} of {totalPages} · {result.total} record{result.total === 1 ? "" : "s"}
            </p>
            <div className="flex gap-2">
              {currentPage > 1 && (
                <Link href={logHref(params, currentPage - 1)} className={buttonClass("outline", "md")}>
                  Previous
                </Link>
              )}
              {currentPage < totalPages && (
                <Link href={logHref(params, currentPage + 1)} className={buttonClass("outline", "md")}>
                  Next
                </Link>
              )}
            </div>
          </div>
        </>
      )}
    </>
  );
}
