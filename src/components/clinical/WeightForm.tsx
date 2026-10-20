"use client";

import { useActionState } from "react";
import { recordWeightAction } from "@/app/actions/clinical";
import type { FormState } from "@/app/actions/auth";
import { Alert } from "@/components/ui/Alert";
import { FormField, SelectField } from "@/components/ui/FormField";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { recordableAppointmentLabel, type RecordableAppointment } from "@/lib/clinical/constants";

const initial: FormState = {};

export function WeightForm({
  petId,
  returnTo,
  appointments,
  appointmentId,
  defaultWeight = "",
}: {
  petId: string;
  returnTo: string;
  appointments?: RecordableAppointment[];
  /** When set, the reading is stored against this visit and the visit cannot be changed. */
  appointmentId?: string;
  /** Latest recorded weight, so a correction starts from the check-in reading. */
  defaultWeight?: string;
}) {
  const [state, formAction] = useActionState(recordWeightAction, initial);
  const values = state.values ?? {};

  return (
    <form action={formAction} className="mt-4 space-y-4" noValidate>
      {state.error && <Alert variant="error">{state.error}</Alert>}
      <input type="hidden" name="petId" value={petId} />
      <input type="hidden" name="returnTo" value={returnTo} />
      {appointmentId ? (
        <input type="hidden" name="appointmentId" value={appointmentId} />
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
        label="Weight (kg)"
        name="weightKg"
        inputMode="decimal"
        placeholder="0.00"
        errors={state.fieldErrors?.weightKg}
        defaultValue={values.weightKg ?? defaultWeight}
        hint="Saving a correction keeps the earlier reading in the history."
      />
      <SubmitButton pendingText="Saving...">{defaultWeight ? "Update weight" : "Save weight"}</SubmitButton>
    </form>
  );
}
