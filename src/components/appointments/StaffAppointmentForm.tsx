"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { createStaffAppointmentAction, fetchStaffBookingAvailabilityAction } from "@/app/actions/appointments";
import type { FormState } from "@/app/actions/auth";
import { AppointmentBookingSummary } from "@/components/appointments/AppointmentBookingSummary";
import { Alert } from "@/components/ui/Alert";
import { SelectField } from "@/components/ui/FormField";
import { SubmitButton } from "@/components/ui/SubmitButton";
import type { AvailabilityRow, ServiceRow, VeterinarianRow } from "@/lib/appointments/constants";
import { formatTime12, isStaffBookableSlot, slotStateLabel, SOURCE_LABELS } from "@/lib/appointments/constants";
import { formatDate } from "@/lib/dates";

const initial: FormState = {};

type PetOption = { id: string; name: string; owner_id: string };

export function StaffAppointmentForm({
  clientId,
  clientName,
  pets,
  services,
  veterinarians,
  day,
  defaultSource,
}: {
  clientId: string;
  clientName: string;
  pets: PetOption[];
  services: ServiceRow[];
  veterinarians: VeterinarianRow[];
  day: string;
  defaultSource: "APPOINTMENT" | "WALK_IN";
}) {
  const [state, formAction] = useActionState(createStaffAppointmentAction, initial);
  const [source, setSource] = useState<"APPOINTMENT" | "WALK_IN">(defaultSource);
  const [petId, setPetId] = useState(pets[0]?.id ?? "");
  const [serviceId, setServiceId] = useState(services[0]?.id ?? "");
  const [vetId, setVetId] = useState(veterinarians[0]?.id ?? "");
  const [slotId, setSlotId] = useState("");
  const [allowOverCapacity, setAllowOverCapacity] = useState(false);
  const [availability, setAvailability] = useState<AvailabilityRow[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [slotError, setSlotError] = useState<string | null>(null);

  const selectedPet = pets.find((p) => p.id === petId);
  const selectedService = services.find((s) => s.id === serviceId);
  const needsVet = Boolean(selectedService?.requires_veterinarian);
  const selectedVet = veterinarians.find((vet) => vet.id === vetId);
  const selectedSlot = availability.find((a) => a.slot_id === slotId && isStaffBookableSlot(a.slot_state, source));

  useEffect(() => {
    if (!serviceId || !petId || (needsVet && !vetId)) {
      setAvailability([]);
      setLoadingSlots(false);
      return;
    }

    let cancelled = false;
    setLoadingSlots(true);
    setSlotError(null);
    void fetchStaffBookingAvailabilityAction(clientId, serviceId, needsVet ? vetId : null, petId).then((result) => {
      if (cancelled) return;
      setLoadingSlots(false);
      if ("error" in result) {
        setAvailability([]);
        setSlotError(result.error);
        return;
      }
      setAvailability(result.availability);
    });

    return () => {
      cancelled = true;
    };
  }, [clientId, needsVet, petId, serviceId, vetId]);

  useEffect(() => {
    if (!slotId) return;
    const chosen = availability.find((slot) => slot.slot_id === slotId);
    if (!chosen || !isStaffBookableSlot(chosen.slot_state, source)) setSlotId("");
  }, [availability, slotId, source]);

  const bookingReady = Boolean(selectedPet && selectedService && selectedSlot && (!needsVet || selectedVet));

  const reviewRows = useMemo(() => {
    if (!bookingReady || !selectedPet || !selectedService || !selectedSlot) return [];
    return [
      { label: "Client", value: clientName },
      { label: "Pet", value: selectedPet.name },
      { label: "Service", value: selectedService.name },
      ...(needsVet && selectedVet ? [{ label: "Veterinarian", value: selectedVet.display_name }] : []),
      { label: "Date", value: formatDate(selectedSlot.slot_date) },
      { label: "Time", value: formatTime12(selectedSlot.start_time) },
      { label: "Source", value: SOURCE_LABELS[source] },
      ...(allowOverCapacity ? [{ label: "Capacity", value: "Staff override (over capacity)" }] : []),
    ];
  }, [
    allowOverCapacity,
    bookingReady,
    clientName,
    needsVet,
    selectedPet,
    selectedService,
    selectedSlot,
    selectedVet,
    source,
  ]);

  function selectService(nextServiceId: string) {
    setServiceId(nextServiceId);
    setSlotId("");
    const next = services.find((service) => service.id === nextServiceId);
    if (next?.requires_veterinarian && !veterinarians.some((vet) => vet.id === vetId)) {
      setVetId(veterinarians[0]?.id ?? "");
    }
  }

  return (
    <form action={formAction} className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6">
      {state.error && <Alert variant="error">{state.error}</Alert>}
      {slotError && <Alert variant="error">{slotError}</Alert>}
      <input type="hidden" name="clientId" value={clientId} />
      <input type="hidden" name="day" value={day} />

      <SelectField
        label="Source"
        name="source"
        value={source}
        onChange={(e) => {
          const next = e.target.value as typeof source;
          setSource(next);
          const chosen = availability.find((slot) => slot.slot_id === slotId);
          if (chosen && !isStaffBookableSlot(chosen.slot_state, next)) setSlotId("");
        }}
      >
        <option value="WALK_IN">Walk-in</option>
        <option value="APPOINTMENT">Appointment (on behalf)</option>
      </SelectField>

      <SelectField label="Pet" name="petId" required value={petId} onChange={(e) => { setPetId(e.target.value); setSlotId(""); }}>
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
        onChange={(e) => selectService(e.target.value)}
      >
        {services.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </SelectField>

      {needsVet && (
        <SelectField
          label="Veterinarian"
          name="veterinarianId"
          required
          value={vetId}
          onChange={(e) => {
            setVetId(e.target.value);
            setSlotId("");
          }}
        >
          {veterinarians.length === 0 ? (
            <option value="">No veterinarian is available</option>
          ) : (
            veterinarians.map((vet) => (
              <option key={vet.id} value={vet.id}>
                {vet.display_name}
              </option>
            ))
          )}
        </SelectField>
      )}

      <SelectField label="Time slot" name="slotId" required value={slotId} onChange={(e) => setSlotId(e.target.value)}>
        <option value="">{loadingSlots ? "Loading times..." : "Select a slot"}</option>
        {availability.map((a) => (
          <option key={a.slot_id} value={a.slot_id} disabled={!isStaffBookableSlot(a.slot_state, source)}>
            {formatDate(a.slot_date)} {formatTime12(a.start_time)} — {slotStateLabel(a.slot_state)} ({a.booked_count}/
            {a.capacity})
          </option>
        ))}
      </SelectField>
      {source === "WALK_IN" && (
        <p className="-mt-3 text-sm text-slate-600">Earlier times today can be saved as a walk-in. Dates before today stay closed.</p>
      )}
      {needsVet && veterinarians.length === 0 && (
        <p className="-mt-3 text-sm text-slate-600">Add an active veterinarian before booking this service.</p>
      )}

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
        <SubmitButton className="mt-4" disabled={!bookingReady || loadingSlots}>
          Create booking
        </SubmitButton>
      </section>
    </form>
  );
}
