import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AppointmentStatusActions } from "@/components/appointments/AppointmentStatusActions";
import { AppointmentStatusBadge } from "@/components/appointments/AppointmentStatusBadge";
import { AppointmentStatusNotice } from "@/components/appointments/AppointmentStatusNotice";
import { DashboardHeading } from "@/components/portal/PlaceholderCard";
import { buttonClass } from "@/components/ui/button-styles";
import { formatTime12, SOURCE_LABELS } from "@/lib/appointments/constants";
import { getAppointmentById } from "@/lib/appointments/server";
import { requireRole } from "@/lib/auth/session";
import { formatDate } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Appointment Details" };

export default async function ClientAppointmentDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ appointmentId: string }>;
  searchParams: Promise<{ notice?: string; statusError?: string }>;
}) {
  const profile = await requireRole(["CLIENT"]);
  const { appointmentId } = await params;
  const query = await searchParams;
  const supabase = await createClient();
  const appointment = await getAppointmentById(supabase, appointmentId);
  if (!appointment) notFound();
  if (appointment.client_id !== profile.id) redirect("/access-denied");

  const { slot } = appointment;

  return (
    <>
      <DashboardHeading title="Appointment details" subtitle="Status and visit information for this booking." />
      <AppointmentStatusNotice notice={query.notice} statusError={query.statusError} />
      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h2 className="text-lg font-semibold">{appointment.service.name}</h2>
          <AppointmentStatusBadge status={appointment.status} />
        </div>
        <dl className="mt-6 grid gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-xs font-medium uppercase text-slate-500">Pet</dt>
            <dd className="mt-1 text-sm">{appointment.pet.name}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase text-slate-500">Date</dt>
            <dd className="mt-1 text-sm">{formatDate(slot.slot_date)}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase text-slate-500">Time</dt>
            <dd className="mt-1 text-sm">{formatTime12(slot.start_time)}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase text-slate-500">Source</dt>
            <dd className="mt-1 text-sm">{SOURCE_LABELS[appointment.source]}</dd>
          </div>
          {slot.veterinarian && (
            <div>
              <dt className="text-xs font-medium uppercase text-slate-500">Veterinarian</dt>
              <dd className="mt-1 text-sm">{slot.veterinarian.display_name}</dd>
            </div>
          )}
        </dl>
        {appointment.status === "PENDING" && (
          <p className="mt-6 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-900">
            This appointment is pending. You can cancel it if you change your mind.
          </p>
        )}
        <AppointmentStatusActions role="CLIENT" appointmentId={appointment.id} status={appointment.status} />
        <Link href="/client/appointments" className={buttonClass("outline", "md", "mt-8 inline-flex")}>
          Back to appointments
        </Link>
      </section>
    </>
  );
}
