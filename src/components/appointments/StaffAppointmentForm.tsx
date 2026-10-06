"use client";

import { useActionState } from "react";
import { createStaffAppointmentAction } from "@/app/actions/appointments";
import type { FormState } from "@/app/actions/auth";
import { Alert } from "@/components/ui/Alert";
import { SelectField } from "@/components/ui/FormField";
import { SubmitButton } from "@/components/ui/SubmitButton";
import type { AvailabilityRow, ServiceRow } from "@/lib/appointments/constants";
import { formatTime12 } from "@/lib/appointments/constants";
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

  return (
    <form action={formAction} className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6">
      {state.error && <Alert variant="error">{state.error}</Alert>}
      <input type="hidden" name="clientId" value={clientId} />
      <input type="hidden" name="day" value={day} />
      <p className="text-sm text-slate-600">
        Client: <span className="font-semibold text-slate-900">{clientName}</span>
      </p>

      <SelectField label="Source" name="source" defaultValue={defaultSource}>
        <option value="WALK_IN">Walk-in</option>
        <option value="APPOINTMENT">Appointment (on behalf)</option>
      </SelectField>

      <SelectField label="Pet" name="petId" required>
        {pets.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </SelectField>

      <SelectField label="Service" name="serviceId" required>
        {services.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </SelectField>

      <SelectField label="Time slot" name="slotId" required defaultValue="">
        <option value="">Select a slot</option>
        {availability.map((a) => (
          <option key={a.slot_id} value={a.slot_id} disabled={a.slot_state !== "AVAILABLE"}>
            {formatDate(a.slot_date)} {formatTime12(a.start_time)} — {a.slot_state} ({a.booked_count}/
            {a.capacity})
          </option>
        ))}
      </SelectField>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="allowOverCapacity" className="rounded border-slate-300" />
        Allow over capacity (staff override)
      </label>

      <SubmitButton>Create booking</SubmitButton>
    </form>
  );
}
