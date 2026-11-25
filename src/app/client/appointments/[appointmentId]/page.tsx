import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { withdrawRescheduleRequestAction } from "@/app/actions/reschedule";
import { AppointmentSmsList, type AppointmentSmsRow } from "@/components/appointments/AppointmentSmsList";
import { AppointmentStatusActions } from "@/components/appointments/AppointmentStatusActions";
import { AppointmentStatusBadge } from "@/components/appointments/AppointmentStatusBadge";
import { AppointmentStatusNotice } from "@/components/appointments/AppointmentStatusNotice";
import { FlashNotice } from "@/components/appointments/FlashNotice";
import { RescheduleSlotForm } from "@/components/appointments/RescheduleSlotForm";
import { DashboardHeading } from "@/components/portal/PlaceholderCard";
import { buttonClass } from "@/components/ui/button-styles";
import { panelClass } from "@/components/ui/panel-styles";
import { appointmentSlotStartMs, formatTime12, SOURCE_LABELS } from "@/lib/appointments/constants";
import { canRescheduleAppointment } from "@/lib/appointments/reschedule";
import { fetchAvailability, getAppointmentById, listActiveVeterinarians } from "@/lib/appointments/server";
import { requireRole } from "@/lib/auth/session";
import { formatDate } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Appointment Details" };

type RescheduleRequestRow = {
  id: string;
  status: string;
  reason: string | null;
  review_note: string | null;
  requested_slot_date: string;
  requested_start_time: string;
};

export default async function ClientAppointmentDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ appointmentId: string }>;
  searchParams: Promise<{ notice?: string; statusError?: string; flash?: string; flashError?: string }>;
}) {
  const profile = await requireRole(["CLIENT"]);
  const { appointmentId } = await params;
  const query = await searchParams;
  const supabase = await createClient();
  const appointment = await getAppointmentById(supabase, appointmentId);
  if (!appointment) notFound();
  if (appointment.client_id !== profile.id) redirect("/access-denied");

  const { slot } = appointment;
  const upcoming = appointmentSlotStartMs(slot.slot_date, slot.start_time) > Date.now();
  const canRequest = canRescheduleAppointment(appointment.status) && upcoming;
  const [{ data: smsData }, { data: requestData }] = await Promise.all([
    supabase.rpc("list_appointment_sms", { p_appointment_id: appointmentId }),
    supabase.rpc("list_appointment_reschedule_requests", { p_appointment_id: appointmentId }),
  ]);
  const messages = (Array.isArray(smsData) ? smsData : []) as AppointmentSmsRow[];
  const requests = (Array.isArray(requestData) ? requestData : []) as RescheduleRequestRow[];
  const pendingRequest = requests.find((request) => request.status === "PENDING");

  let slots: Awaited<ReturnType<typeof fetchAvailability>> = [];
  const veterinarians = appointment.service.requires_veterinarian ? await listActiveVeterinarians(supabase) : [];
  if (canRequest && !pendingRequest) {
    try {
      const availability = await fetchAvailability(
        supabase,
        appointment.service.id,
        slot.veterinarian?.id ?? null,
        undefined,
        undefined,
        appointment.pet.id,
      );
      slots = availability.filter((row) => row.slot_state === "AVAILABLE" && row.slot_id !== appointment.slot.id);
    } catch {
      slots = [];
    }
  }
  const openSlots = slots;

  return (
    <>
      <DashboardHeading title="Appointment details" />
      <AppointmentStatusNotice notice={query.notice} statusError={query.statusError} />
      <FlashNotice flash={query.flash} flashError={query.flashError} />
      <section className={panelClass("mt-6 p-6")}>
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
            {slot.requires_vet_acceptance ? " It is not confirmed until the clinic accepts it." : ""}
          </p>
        )}
        <AppointmentStatusActions role="CLIENT" appointmentId={appointment.id} status={appointment.status} />
        <Link href="/client/appointments" className={buttonClass("outline", "md", "mt-8 inline-flex")}>
          Back to appointments
        </Link>
      </section>

      <section className={panelClass("mt-6 p-6")}>
        <h2 className="text-lg font-semibold text-ink">Reschedule</h2>
        {pendingRequest ? (
          <div className="mt-4">
            <p className="text-sm text-ink">
              Requested time: {formatDate(pendingRequest.requested_slot_date)} at {formatTime12(pendingRequest.requested_start_time)}. Status: pending review.
            </p>
            {pendingRequest.reason && <p className="mt-2 text-sm text-muted">Reason: {pendingRequest.reason}</p>}
            <form action={withdrawRescheduleRequestAction} className="mt-4">
              <input type="hidden" name="appointmentId" value={appointment.id} />
              <input type="hidden" name="requestId" value={pendingRequest.id} />
              <button type="submit" className={buttonClass("outline", "md")}>
                Withdraw request
              </button>
            </form>
          </div>
        ) : canRequest ? (
          <RescheduleSlotForm
            appointmentId={appointment.id}
            mode="client"
            currentVetId={slot.veterinarian?.id ?? null}
            requiresVeterinarian={appointment.service.requires_veterinarian}
            veterinarians={veterinarians}
            initialSlots={openSlots}
          />
        ) : (
          <p className="mt-3 text-sm text-muted">This appointment cannot be rescheduled.</p>
        )}
        {requests.filter((request) => request.status !== "PENDING").length > 0 && (
          <ul className="mt-6 space-y-2 text-sm text-muted">
            {requests
              .filter((request) => request.status !== "PENDING")
              .map((request) => (
                <li key={request.id}>
                  {request.status.toLowerCase()}: {formatDate(request.requested_slot_date)} at {formatTime12(request.requested_start_time)}
                  {request.review_note ? `. ${request.review_note}` : ""}
                </li>
              ))}
          </ul>
        )}
      </section>

      <section className={panelClass("mt-6 p-6")}>
        <h2 className="text-lg font-semibold text-ink">Text messages</h2>
        <AppointmentSmsList messages={messages} audience="client" />
      </section>
    </>
  );
}
