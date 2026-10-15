"use client";

import { useActionState, useMemo, useState } from "react";
import { createStaffAppointmentAction } from "@/app/actions/appointments";
import type { FormState } from "@/app/actions/auth";
import { AppointmentBookingSummary } from "@/components/appointments/AppointmentBookingSummary";
import { Alert } from "@/components/ui/Alert";
import { SelectField } from "@/components/ui/FormField";
import { SubmitButton } from "@/components/ui/SubmitButton";
import type { AvailabilityRow, ServiceRow } from "@/lib/appointments/constants";
import { formatTime12, SOURCE_LABELS } from "@/lib/appointments/constants";
import { formatDate } from "@/lib/dates";

const initial: FormState = {};

type PetOption = { id: string; name: string; owner_id: string };

export function StaffAppointmentForm({
  clientId,
  clientName,
  pets,
  services,
  availability,
  day,
  defaultSource,
}: {
  clientId: string;
  clientName: string;
  pets: PetOption[];
  services: ServiceRow[];
  availability: AvailabilityRow[];
  day: string;
  defaultSource: "APPOINTMENT" | "WALK_IN";
}) {
  const [state, formAction] = useActionState(createStaffAppointmentAction, initial);
  const [source, setSource] = useState<"APPOINTMENT" | "WALK_IN">(defaultSource);
  const [petId, setPetId] = useState(pets[0]?.id ?? "");
  const [serviceId, setServiceId] = useState(services[0]?.id ?? "");
  const [slotId, setSlotId] = useState("");
  const [allowOverCapacity, setAllowOverCapacity] = useState(false);

  const selectedPet = pets.find((p) => p.id === petId);
  const selectedService = services.find((s) => s.id === serviceId);
  const selectedSlot = availability.find((a) => a.slot_id === slotId && a.slot_state === "AVAILABLE");

  const bookingReady = Boolean(selectedPet && selectedService && selectedSlot);

  const reviewRows = useMemo(() => {
    if (!bookingReady || !selectedPet || !selectedService || !selectedSlot) return [];
    return [
      { label: "Client", value: clientName },
      { label: "Pet", value: selectedPet.name },
      { label: "Service", value: selectedService.name },
      { label: "Date", value: formatDate(selectedSlot.slot_date) },
      { label: "Time", value: formatTime12(selectedSlot.start_time) },
      { label: "Source", value: SOURCE_LABELS[source] },
      ...(allowOverCapacity ? [{ label: "Capacity", value: "Staff override (over capacity)" }] : []),
    ];
  }, [
    allowOverCapacity,
    bookingReady,
    clientName,
    selectedPet,
    selectedService,
    selectedSlot,
    source,
  ]);

  return (
    <form action={formAction} className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6">
      {state.error && <Alert variant="error">{state.error}</Alert>}
      <input type="hidden" name="clientId" value={clientId} />
      <input type="hidden" name="day" value={day} />

      <SelectField label="Source" name="source" value={source} onChange={(e) => setSource(e.target.value as typeof source)}>
        <option value="WALK_IN">Walk-in</option>
        <option value="APPOINTMENT">Appointment (on behalf)</option>
      </SelectField>

      <SelectField label="Pet" name="petId" required value={petId} onChange={(e) => setPetId(e.target.value)}>
        {pets.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </SelectField>

      <SelectField
        label="Service"
        name="serviceId"
        required
        value={serviceId}
        onChange={(e) => setServiceId(e.target.value)}
      >
        {services.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </SelectField>

      <SelectField label="Time slot" name="slotId" required value={slotId} onChange={(e) => setSlotId(e.target.value)}>
        <option value="">Select a slot</option>
        {availability.map((a) => (
          <option key={a.slot_id} value={a.slot_id} disabled={a.slot_state !== "AVAILABLE"}>
            {formatDate(a.slot_date)} {formatTime12(a.start_time)} — {a.slot_state} ({a.booked_count}/
            {a.capacity})
          </option>
        ))}
      </SelectField>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="allowOverCapacity"
          checked={allowOverCapacity}
          onChange={(e) => setAllowOverCapacity(e.target.checked)}
          className="rounded border-slate-300"
        />
        Allow over capacity (staff override)
      </label>

      <section className="border-t border-slate-200 pt-5">
        <h2 className="text-base font-semibold text-slate-900">Review and confirm</h2>
        {!bookingReady && (
          <p className="mt-2 text-sm text-slate-600">Select a pet, service, and available time slot to continue.</p>
        )}
        {bookingReady && (
          <div className="mt-4">
            <AppointmentBookingSummary
              rows={reviewRows}
              vetAcceptancePending={Boolean(selectedSlot?.requires_vet_acceptance)}
            />
          </div>
        )}
        <SubmitButton className="mt-4" disabled={!bookingReady}>
          Create booking
        </SubmitButton>
      </section>
    </form>
  );
}
