import Link from "next/link";
import { notFound } from "next/navigation";
import { openPosForAppointmentAction } from "@/app/actions/pos";
import { approveRescheduleRequestAction, rejectRescheduleRequestAction } from "@/app/actions/reschedule";
import { sendAppointmentReminderNowAction } from "@/app/actions/sms";
import type { AppointmentSmsRow } from "@/components/appointments/AppointmentSmsList";
import { AppointmentStatusActions } from "@/components/appointments/AppointmentStatusActions";
import { AppointmentStatusBadge } from "@/components/appointments/AppointmentStatusBadge";
import { AppointmentStatusNotice } from "@/components/appointments/AppointmentStatusNotice";
import { FlashNotice } from "@/components/appointments/FlashNotice";
import { RescheduleSlotForm } from "@/components/appointments/RescheduleSlotForm";
import { buttonClass } from "@/components/ui/button-styles";
import { ConfirmSubmitButton } from "@/components/ui/ConfirmSubmitButton";
import { panelClass } from "@/components/ui/panel-styles";
import { MedicalRecords } from "@/components/clinical/MedicalRecords";
import type { VisitEntry } from "@/components/clinical/VisitRecords";
import { Alert } from "@/components/ui/Alert";
import { appointmentSlotStartMs, formatTime12, SOURCE_LABELS } from "@/lib/appointments/constants";
import { canRescheduleAppointment } from "@/lib/appointments/reschedule";
import {
  fetchAvailability,
  getAppointmentByIdWithClient,
  getVeterinarianIdForProfile,
  listActiveVeterinarians,
} from "@/lib/appointments/server";
import { requireRole } from "@/lib/auth/session";
import { CLINICAL_NOTICES, isRecordableAppointmentStatus } from "@/lib/clinical/constants";
import {
  listClinicalRecords,
  listVaccinationRecords,
  listWeightRecords,
} from "@/lib/clinical/server";
import { formatDate, todayIso } from "@/lib/dates";
import { listVisitBills } from "@/lib/pos/server";
import { canBillAppointment, paymentLabel } from "@/lib/pos/status";
import { createClient } from "@/lib/supabase/server";

type RescheduleRequestRow = {
  id: string;
  status: string;
  reason: string | null;
  review_note: string | null;
  requested_slot_date: string;
  requested_start_time: string;
};

export async function AppointmentDetail({
  appointmentId,
  flash,
  flashError,
  message,
  entry,
  notice,
  statusError,
  homePath,
}: {
  appointmentId: string;
  flash?: string;
  flashError?: string;
  message?: string;
  entry?: string;
  notice?: string;
  statusError?: string;
  homePath: "/staff/appointments" | "/senior-vet/appointments";
}) {
  const profile = await requireRole(["STAFF", "SENIOR_VET"]);
  const supabase = await createClient();
  const appointment = await getAppointmentByIdWithClient(supabase, appointmentId);
  if (!appointment) notFound();

  const { slot } = appointment;
  const detailPath = `${homePath}/${appointment.id}`;
  const upcoming = appointmentSlotStartMs(slot.slot_date, slot.start_time) > Date.now();
  const canChange = canRescheduleAppointment(appointment.status) && upcoming;
  const [{ data: smsData }, { data: requestData }] = await Promise.all([
    supabase.rpc("list_appointment_sms", { p_appointment_id: appointmentId }),
    supabase.rpc("list_appointment_reschedule_requests", { p_appointment_id: appointmentId }),
  ]);
  const messages = (Array.isArray(smsData) ? smsData : []) as AppointmentSmsRow[];
  const requests = (Array.isArray(requestData) ? requestData : []) as RescheduleRequestRow[];
  const pending = requests.find((request) => request.status === "PENDING");
  const veterinarians = await listActiveVeterinarians(supabase);
  const visitEntry: VisitEntry = entry === "vaccination" || entry === "revise" ? entry : "clinical";
  const recordable = isRecordableAppointmentStatus(appointment.status);
  const isSeniorVet = profile.role === "SENIOR_VET";
  const visitBills = await listVisitBills(supabase, appointment.id);
  const visitPayment = paymentLabel(visitBills.map((bill) => bill.status));
  const openBill = visitBills.find((bill) => bill.status === "OPEN");
  const hasPaidBill = visitBills.some((bill) => bill.status === "COMPLETED");
  const showPos = canBillAppointment(appointment.status);
  const unpaidVisit = showPos && !hasPaidBill;
  const [weights, clinical, vaccinations, linkedVetId] = await Promise.all([
    listWeightRecords(supabase, appointment.pet.id),
    listClinicalRecords(supabase, appointment.pet.id),
    listVaccinationRecords(supabase, appointment.pet.id),
    isSeniorVet ? getVeterinarianIdForProfile(supabase, profile.id) : Promise.resolve(null),
  ]);
  let openSlots: Awaited<ReturnType<typeof fetchAvailability>> = [];
  if (canChange) {
    try {
      const availability = await fetchAvailability(
        supabase,
        appointment.service.id,
        slot.veterinarian?.id ?? null,
        undefined,
        undefined,
        appointment.pet.id,
      );
      openSlots = availability.filter((row) => row.slot_state === "AVAILABLE" && row.slot_id !== appointment.slot.id);
    } catch {
      openSlots = [];
    }
  }

  return (
    <>
      <AppointmentStatusNotice notice={notice} statusError={statusError} />
      <FlashNotice flash={flash} flashError={flashError} />
      <section className={panelClass("p-6")}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-ink">{appointment.service.name}</h2>
            <p className="mt-1 text-sm text-muted">
              {appointment.pet.name} · {appointment.client?.full_name ?? "Client"}
            </p>
          </div>
          <AppointmentStatusBadge status={appointment.status} />
        </div>
        <dl className="mt-6 grid gap-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs uppercase text-muted">When</dt>
            <dd className="mt-1">{formatDate(slot.slot_date)} at {formatTime12(slot.start_time)}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-muted">Source</dt>
            <dd className="mt-1">{SOURCE_LABELS[appointment.source]}</dd>
          </div>
          {slot.veterinarian && (
            <div>
              <dt className="text-xs uppercase text-muted">Veterinarian</dt>
              <dd className="mt-1">{slot.veterinarian.display_name}</dd>
            </div>
          )}
          {(showPos || visitBills.length > 0) && (
            <div>
              <dt className="text-xs uppercase text-muted">Payment</dt>
              <dd className="mt-1">
                {visitPayment}
                {hasPaidBill && visitPayment !== "Paid" ? " · a completed payment is also on file" : ""}
              </dd>
            </div>
          )}
        </dl>
        {unpaidVisit && (
          <p className="mt-4 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-900">
            No completed payment is recorded for this visit ({visitPayment}). You can still mark the visit completed.
          </p>
        )}
        {slot.requires_vet_acceptance && appointment.status === "PENDING" && (
          <p className="mt-4 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-900">
            This visit is pending veterinarian acceptance. Rescheduling does not confirm it.
          </p>
        )}
        <div className="mt-6 flex flex-wrap items-center gap-2">
          <AppointmentStatusActions
            inline
            role={profile.role === "SENIOR_VET" ? "SENIOR_VET" : "STAFF"}
            appointmentId={appointment.id}
            status={appointment.status}
            slotDate={slot.slot_date}
            returnTo={detailPath}
            petName={appointment.pet.name}
          />
          {canChange && !messages.some((message) =>
            message.message_type === "APPOINTMENT_REMINDER" &&
            message.schedule_version === appointment.schedule_version &&
            (message.status === "SENT" || message.status === "QUEUED" || message.outcome_uncertain),
          ) && (
            <form action={sendAppointmentReminderNowAction}>
              <input type="hidden" name="appointmentId" value={appointment.id} />
              <input type="hidden" name="returnTo" value={detailPath} />
              <ConfirmSubmitButton
                variant="primary"
                confirmMessage="Send the appointment reminder now? This uses SMS credits."
                pendingText="Sending..."
              >
                Send Appointment Reminder
              </ConfirmSubmitButton>
            </form>
          )}
          <Link href={homePath} className={buttonClass("outline", "md")}>
            Back to schedule
          </Link>
          {showPos && openBill && (
            <Link href={`/staff/pos/${openBill.id}`} className={buttonClass("primary", "md")}>
              Resume bill
            </Link>
          )}
          {showPos && !openBill && (
            <form action={openPosForAppointmentAction}>
              <input type="hidden" name="appointmentId" value={appointment.id} />
              <input type="hidden" name="returnTo" value={detailPath} />
              <button type="submit" className={buttonClass("primary", "md")}>
                Open POS
              </button>
            </form>
          )}
          {isSeniorVet && (appointment.status === "IN_CONSULTATION" || appointment.status === "COMPLETED") && (
            <Link href="#visit-record" className={buttonClass("primary", "md")}>
              Record visit
            </Link>
          )}
        </div>
      </section>

      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <MedicalRecords
          petId={appointment.pet.id}
          returnTo={detailPath}
          weights={weights}
          clinical={clinical}
          vaccinations={vaccinations}
          canRecordWeight={recordable}
          canEditMedical={false}
          appointmentId={appointment.id}
          showVisit={false}
        />
      </div>

      {message && CLINICAL_NOTICES[message] && (
        <div className="mt-6">
          <Alert variant="success">{CLINICAL_NOTICES[message]}</Alert>
        </div>
      )}

      <div className="mt-6">
        <MedicalRecords
          petId={appointment.pet.id}
          returnTo={detailPath}
          weights={weights}
          clinical={clinical}
          vaccinations={vaccinations}
          canRecordWeight={false}
          canEditMedical={isSeniorVet && recordable}
          veterinarians={veterinarians}
          appointmentId={appointment.id}
          defaultVisitDate={slot.slot_date > todayIso() ? todayIso() : slot.slot_date}
          defaultVeterinarianId={slot.veterinarian?.id ?? linkedVetId}
          initialEntry={visitEntry}
          prompt={isSeniorVet && (appointment.status === "IN_CONSULTATION" || appointment.status === "COMPLETED")}
          showWeight={false}
        />
        <p className="mt-3 text-sm">
          <Link href={`/staff/pets/${appointment.pet.id}`} className="font-semibold text-brand hover:underline">
            Open {appointment.pet.name}&apos;s full record
          </Link>
        </p>
      </div>

      <section className={panelClass("mt-6 p-6")}>
        <h2 className="text-lg font-semibold text-ink">Reschedule</h2>
        {pending && (
          <div className="mt-4 rounded-xl border border-line p-4">
            <p className="text-sm text-ink">
              Client requested {formatDate(pending.requested_slot_date)} at {formatTime12(pending.requested_start_time)}.
            </p>
            {pending.reason && <p className="mt-2 text-sm text-muted">Reason: {pending.reason}</p>}
            <div className="mt-4 flex flex-wrap gap-2">
              <form action={approveRescheduleRequestAction}>
                <input type="hidden" name="appointmentId" value={appointment.id} />
                <input type="hidden" name="requestId" value={pending.id} />
                <input type="hidden" name="returnTo" value={detailPath} />
                <button type="submit" className={buttonClass("primary", "md")}>Approve</button>
              </form>
              <form action={rejectRescheduleRequestAction} className="flex flex-wrap items-center gap-2">
                <input type="hidden" name="appointmentId" value={appointment.id} />
                <input type="hidden" name="requestId" value={pending.id} />
                <input type="hidden" name="returnTo" value={detailPath} />
                <input name="reviewNote" placeholder="Note (optional)" maxLength={500} className="min-h-11 rounded-lg border border-line px-3 text-sm" />
                <button type="submit" className={buttonClass("outline", "md")}>Reject</button>
              </form>
            </div>
          </div>
        )}
        {canChange ? (
          <RescheduleSlotForm
            appointmentId={appointment.id}
            mode="staff"
            currentVetId={slot.veterinarian?.id ?? null}
            requiresVeterinarian={appointment.service.requires_veterinarian}
            veterinarians={veterinarians}
            initialSlots={openSlots}
            returnTo={detailPath}
          />
        ) : (
          <p className="mt-3 text-sm text-muted">Only pending and confirmed appointments that have not started can be rescheduled.</p>
        )}
      </section>
    </>
  );
}
