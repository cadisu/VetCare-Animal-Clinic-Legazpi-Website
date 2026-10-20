"use client";

import { useState } from "react";
import { useActionState } from "react";
import { saveClinicalRecordAction } from "@/app/actions/clinical";
import type { FormState } from "@/app/actions/auth";
import { Alert } from "@/components/ui/Alert";
import { FormField, SelectField, TextAreaField } from "@/components/ui/FormField";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { buttonClass } from "@/components/ui/button-styles";
import { recordableAppointmentLabel, type RecordableAppointment } from "@/lib/clinical/constants";
import type { VeterinarianRow } from "@/lib/appointments/constants";
import { todayIso } from "@/lib/dates";

const initial: FormState = {};

export function ClinicalRecordForm({
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
  const [state, formAction] = useActionState(saveClinicalRecordAction, initial);
  const values = { ...defaults, ...state.values };
  const lockedAppointment = appointmentId ?? values.appointmentId ?? "";

  return (
    <form action={formAction} className="mt-4 space-y-4" noValidate>
      {state.error && <Alert variant="error">{state.error}</Alert>}
      <input type="hidden" name="petId" value={petId} />
      <input type="hidden" name="returnTo" value={returnTo} />
      <input type="hidden" name="lineageId" value={lineageId ?? ""} />
      {appointmentId || lineageId ? (
        <input type="hidden" name="appointmentId" value={lockedAppointment} />
      ) : (
        <SelectField
          label="Visit"
          name="appointmentId"
          errors={state.fieldErrors?.appointmentId}
          defaultValue={values.appointmentId ?? ""}
          required
        >
          <option value="">Choose a checked-in visit</option>
          {appointments?.map((appointment) => (
            <option key={appointment.id} value={appointment.id}>
              {recordableAppointmentLabel(appointment)}
            </option>
          ))}
        </SelectField>
      )}
      <FormField
        label="Visit date"
        name="visitDate"
        type="date"
        max={todayIso()}
        errors={state.fieldErrors?.visitDate}
        defaultValue={values.visitDate || todayIso()}
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
        label="Reason for visit"
        name="reasonForVisit"
        errors={state.fieldErrors?.reasonForVisit}
        defaultValue={values.reasonForVisit ?? ""}
        required
      />
      <TextAreaField
        label="Clinical notes"
        name="clinicalNotes"
        rows={4}
        errors={state.fieldErrors?.clinicalNotes}
        defaultValue={values.clinicalNotes ?? ""}
        required
      />
      <TextAreaField
        label="Assessment"
        name="assessment"
        rows={3}
        errors={state.fieldErrors?.assessment}
        defaultValue={values.assessment ?? ""}
        required
      />
      <TextAreaField
        label="Treatment"
        name="treatment"
        rows={3}
        errors={state.fieldErrors?.treatment}
        defaultValue={values.treatment ?? ""}
        required
      />
      <TextAreaField
        label="Follow-up instructions"
        labelNote="(optional)"
        name="followUp"
        rows={3}
        errors={state.fieldErrors?.followUp}
        defaultValue={values.followUp ?? ""}
      />
      <SubmitButton pendingText="Saving...">{lineageId ? "Save revision" : "Save clinical record"}</SubmitButton>
    </form>
  );
}

export function ReviseToggle({ label, children }: { label: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <button type="button" className={buttonClass("outline", "md", "mt-4")} onClick={() => setOpen(true)}>
        {label}
      </button>
    );
  }
  return <>{children}</>;
}
