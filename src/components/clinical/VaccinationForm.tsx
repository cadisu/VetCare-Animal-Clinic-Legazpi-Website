"use client";

import { useActionState } from "react";
import { saveVaccinationAction } from "@/app/actions/clinical";
import type { FormState } from "@/app/actions/auth";
import { Alert } from "@/components/ui/Alert";
import { FormField, SelectField, TextAreaField } from "@/components/ui/FormField";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { recordableAppointmentLabel, type RecordableAppointment } from "@/lib/clinical/constants";
import type { VeterinarianRow } from "@/lib/appointments/constants";
import { todayIso } from "@/lib/dates";

const initial: FormState = {};

export function VaccinationForm({
  petId,
  returnTo,
  veterinarians,
  appointments,
  appointmentId,
  lineageId,
  defaults,
}: {
  petId: string;
  returnTo: string;
  veterinarians: VeterinarianRow[];
  appointments?: RecordableAppointment[];
  appointmentId?: string;
  lineageId?: string;
  defaults?: Record<string, string>;
}) {
  const [state, formAction] = useActionState(saveVaccinationAction, initial);
  const values = { ...defaults, ...state.values };

  return (
    <form action={formAction} className="mt-4 space-y-4" noValidate>
      {state.error && <Alert variant="error">{state.error}</Alert>}
      <input type="hidden" name="petId" value={petId} />
      <input type="hidden" name="returnTo" value={returnTo} />
      <input type="hidden" name="lineageId" value={lineageId ?? ""} />
      {appointmentId || lineageId ? (
        <input type="hidden" name="appointmentId" value={appointmentId ?? values.appointmentId ?? ""} />
      ) : (
        <SelectField
          label="Visit"
          labelNote="(optional)"
          name="appointmentId"
          errors={state.fieldErrors?.appointmentId}
          defaultValue={values.appointmentId ?? ""}
        >
          <option value="">Not linked to a visit</option>
          {appointments?.map((appointment) => (
            <option key={appointment.id} value={appointment.id}>
              {recordableAppointmentLabel(appointment)}
            </option>
          ))}
        </SelectField>
      )}
      <FormField
        label="Vaccine"
        name="vaccineName"
        errors={state.fieldErrors?.vaccineName}
        defaultValue={values.vaccineName ?? ""}
        required
      />
      <FormField
        label="Date administered"
        name="administeredOn"
        type="date"
        max={todayIso()}
        errors={state.fieldErrors?.administeredOn}
        defaultValue={values.administeredOn || todayIso()}
        required
      />
      <FormField
        label="Dose"
        name="dose"
        errors={state.fieldErrors?.dose}
        defaultValue={values.dose ?? ""}
        required
      />
      <SelectField
        label="Veterinarian"
        name="veterinarianId"
        errors={state.fieldErrors?.veterinarianId}
        defaultValue={values.veterinarianId ?? ""}
        required
      >
        <option value="">Choose a veterinarian</option>
        {veterinarians.map((vet) => (
          <option key={vet.id} value={vet.id}>
            {vet.display_name}
          </option>
        ))}
      </SelectField>
      <FormField
        label="Weight at vaccination (kg)"
        labelNote="(optional)"
        name="weightKg"
        inputMode="decimal"
        errors={state.fieldErrors?.weightKg}
        defaultValue={values.weightKg ?? ""}
      />
      <FormField
        label="Next vaccination date"
        labelNote="(optional)"
        name="nextDueOn"
        type="date"
        errors={state.fieldErrors?.nextDueOn}
        defaultValue={values.nextDueOn ?? ""}
      />
      <TextAreaField
        label="Notes"
        labelNote="(optional)"
        name="notes"
        rows={3}
        errors={state.fieldErrors?.notes}
        defaultValue={values.notes ?? ""}
      />
      <SubmitButton pendingText="Saving...">
        {lineageId ? "Save vaccination revision" : "Save vaccination"}
      </SubmitButton>
    </form>
  );
}
