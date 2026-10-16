"use client";

import { useActionState, useState } from "react";
import {
  fetchRescheduleAvailabilityAction,
  rescheduleAppointmentAction,
  submitRescheduleRequestAction,
} from "@/app/actions/reschedule";
import type { FormState } from "@/app/actions/auth";
import { Alert } from "@/components/ui/Alert";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { formatDate } from "@/lib/dates";
import { formatTime12, type AvailabilityRow, type VeterinarianRow } from "@/lib/appointments/constants";

const initial: FormState = {};

export function RescheduleSlotForm({
  appointmentId,
  mode,
  currentVetId,
  requiresVeterinarian,
  veterinarians,
  initialSlots,
  returnTo,
}: {
  appointmentId: string;
  mode: "client" | "staff";
  currentVetId: string | null;
  requiresVeterinarian: boolean;
  veterinarians: VeterinarianRow[];
  initialSlots: AvailabilityRow[];
  returnTo?: string;
}) {
  const action = mode === "client" ? submitRescheduleRequestAction : rescheduleAppointmentAction;
  const [state, formAction] = useActionState(action, initial);
  const [slots, setSlots] = useState(initialSlots);
  const [loadError, setLoadError] = useState<string | null>(null);

  async function onVetChange(veterinarianId: string) {
    setLoadError(null);
    const result = await fetchRescheduleAvailabilityAction(appointmentId, veterinarianId || null);
    if ("error" in result) {
      setSlots([]);
      setLoadError(result.error);
      return;
    }
    setSlots(result.availability);
  }

  return (
    <form action={formAction} className="mt-4 space-y-4">
      <input type="hidden" name="appointmentId" value={appointmentId} />
      {returnTo && <input type="hidden" name="returnTo" value={returnTo} />}
      {state.error && <Alert variant="error">{state.error}</Alert>}
      {loadError && <Alert variant="error">{loadError}</Alert>}
      {requiresVeterinarian && (
        <label className="block text-sm font-medium text-ink">
          Veterinarian
          <select
            name="veterinarianId"
            defaultValue={currentVetId ?? ""}
            onChange={(event) => void onVetChange(event.target.value)}
            className="mt-1.5 block min-h-11 w-full rounded-lg border border-line px-3 text-sm"
          >
            {veterinarians.map((vet) => (
              <option key={vet.id} value={vet.id}>
                {vet.display_name}
              </option>
            ))}
          </select>
        </label>
      )}
      <label className="block text-sm font-medium text-ink">
        New date and time
        <select name="slotId" required defaultValue="" className="mt-1.5 block min-h-11 w-full rounded-lg border border-line px-3 text-sm">
          <option value="" disabled>
            {slots.length === 0 ? "No open times in the booking window" : "Select a time"}
          </option>
          {slots.map((slot) => (
            <option key={slot.slot_id} value={slot.slot_id}>
              {formatDate(slot.slot_date)} at {formatTime12(slot.start_time)}
              {slot.requires_vet_acceptance ? " (needs confirmation)" : ""}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-sm font-medium text-ink">
        Reason <span className="font-normal text-muted">(optional)</span>
        <textarea name="reason" maxLength={500} rows={3} className="mt-1.5 block w-full rounded-lg border border-line px-3 py-2 text-sm" />
      </label>
      <p className="text-sm text-muted">
        {mode === "client"
          ? "Submitting a request does not change this appointment. The clinic will review it."
          : "The visit keeps its current status. A full slot is rejected and the original time stays in place."}
      </p>
      <SubmitButton className="sm:w-auto" pendingText={mode === "client" ? "Submitting..." : "Rescheduling..."}>
        {mode === "client" ? "Submit reschedule request" : "Confirm reschedule"}
      </SubmitButton>
    </form>
  );
}
