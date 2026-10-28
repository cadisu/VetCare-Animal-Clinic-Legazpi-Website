"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { FormState } from "@/app/actions/auth";
import { requireRole } from "@/lib/auth/session";
import { clinicalReturnPath, clinicalRecordSchema, vaccinationSchema, weightSchema } from "@/lib/validation/clinical";
import { createClient } from "@/lib/supabase/server";

const GENERIC_ERROR = "Something went wrong. Please try again.";

const KNOWN_RPC_ERRORS = [
  "Only Senior Vets can modify this clinical record",
  "Not authorized",
  "Pet not found",
  "Appointment not found",
  "Records can only be saved after check-in",
  "Choose an active veterinarian",
  "A clinical record already exists for this visit",
  "Clinical record not found",
  "Vaccination record not found",
  "Enter a weight between 0.01 and 200 kg",
  "Enter a valid visit date",
  "Enter a valid vaccination date",
  "Enter a reason for the visit",
  "Enter the clinical notes",
  "Enter the assessment",
  "Enter the treatment",
  "Follow-up instructions are too long",
  "Enter the vaccine name",
  "Enter the dose",
  "Notes are too long",
  "Next vaccination date cannot be before the dose was given",
  "Weight history cannot be modified",
  "Clinical records cannot be modified",
  "Clinical records cannot be deleted",
  "Vaccination records cannot be modified",
  "Vaccination records cannot be deleted",
];

function text(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function rpcMessage(error: { message?: string } | null): string {
  const message = error?.message ?? "";
  const known = KNOWN_RPC_ERRORS.find((item) => message.includes(item));
  return known ? `${known}.`.replace("..", ".") : GENERIC_ERROR;
}

function fieldState(error: z.ZodError, values: Record<string, string>): FormState {
  return { fieldErrors: z.flattenError(error).fieldErrors, values };
}

function finish(returnTo: string, message: string): never {
  revalidatePath("/staff", "layout");
  revalidatePath("/senior-vet", "layout");
  revalidatePath("/client", "layout");
  const [path, query = ""] = returnTo.split("?");
  const params = new URLSearchParams(query);
  params.set("message", message);
  redirect(`${path}?${params.toString()}`);
}

function seniorScheduleReturn(returnTo: string, visitDate: string): string | null {
  const path = returnTo.split("?")[0] ?? "";
  if (!/^\/senior-vet\/appointments\/[0-9a-f-]{36}$/i.test(path)) return null;
  return /^\d{4}-\d{2}-\d{2}$/.test(visitDate) ? `/senior-vet/appointments?day=${visitDate}` : "/senior-vet/appointments";
}

export async function recordWeightAction(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireRole(["STAFF", "SENIOR_VET"]);
  const values = {
    petId: text(formData, "petId"),
    appointmentId: text(formData, "appointmentId"),
    weightKg: text(formData, "weightKg"),
  };
  const parsed = weightSchema.safeParse(values);
  if (!parsed.success) return fieldState(parsed.error, values);

  const supabase = await createClient();
  const { error } = await supabase.rpc("record_pet_weight", {
    p_pet_id: parsed.data.petId,
    p_weight_kg: parsed.data.weightKg,
    p_appointment_id: parsed.data.appointmentId,
  });
  if (error) return { error: rpcMessage(error), values };

  finish(clinicalReturnPath(text(formData, "returnTo"), `/staff/pets/${parsed.data.petId}`), "weight-saved");
}

export async function saveClinicalRecordAction(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireRole(["SENIOR_VET"]);
  const values = {
    petId: text(formData, "petId"),
    appointmentId: text(formData, "appointmentId"),
    lineageId: text(formData, "lineageId"),
    visitDate: text(formData, "visitDate"),
    veterinarianId: text(formData, "veterinarianId"),
    reasonForVisit: text(formData, "reasonForVisit"),
    clinicalNotes: text(formData, "clinicalNotes"),
    assessment: text(formData, "assessment"),
    treatment: text(formData, "treatment"),
    followUp: text(formData, "followUp"),
  };
  const parsed = clinicalRecordSchema.safeParse(values);
  if (!parsed.success) return fieldState(parsed.error, values);

  const supabase = await createClient();
  const { error } = parsed.data.lineageId
    ? await supabase.rpc("revise_clinical_record", {
        p_lineage_id: parsed.data.lineageId,
        p_visit_date: parsed.data.visitDate,
        p_veterinarian_id: parsed.data.veterinarianId,
        p_reason_for_visit: parsed.data.reasonForVisit,
        p_clinical_notes: parsed.data.clinicalNotes,
        p_assessment: parsed.data.assessment,
        p_treatment: parsed.data.treatment,
        p_follow_up: parsed.data.followUp,
      })
    : await supabase.rpc("create_clinical_record", {
        p_pet_id: parsed.data.petId,
        p_appointment_id: parsed.data.appointmentId,
        p_visit_date: parsed.data.visitDate,
        p_veterinarian_id: parsed.data.veterinarianId,
        p_reason_for_visit: parsed.data.reasonForVisit,
        p_clinical_notes: parsed.data.clinicalNotes,
        p_assessment: parsed.data.assessment,
        p_treatment: parsed.data.treatment,
        p_follow_up: parsed.data.followUp,
      });
  if (error) return { error: rpcMessage(error), values };

  const message = parsed.data.lineageId ? "clinical-revised" : "clinical-saved";
  const returnPath = clinicalReturnPath(text(formData, "returnTo"), `/staff/pets/${parsed.data.petId}`);
  finish(seniorScheduleReturn(returnPath, parsed.data.visitDate) ?? returnPath, message);
}

export async function saveVaccinationAction(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireRole(["SENIOR_VET"]);
  const values = {
    petId: text(formData, "petId"),
    appointmentId: text(formData, "appointmentId"),
    lineageId: text(formData, "lineageId"),
    vaccineName: text(formData, "vaccineName"),
    administeredOn: text(formData, "administeredOn"),
    dose: text(formData, "dose"),
    veterinarianId: text(formData, "veterinarianId"),
    weightKg: text(formData, "weightKg"),
    nextDueOn: text(formData, "nextDueOn"),
    notes: text(formData, "notes"),
  };
  const parsed = vaccinationSchema.safeParse(values);
  if (!parsed.success) return fieldState(parsed.error, values);

  const supabase = await createClient();
  const { error } = parsed.data.lineageId
    ? await supabase.rpc("revise_vaccination_record", {
        p_lineage_id: parsed.data.lineageId,
        p_vaccine_name: parsed.data.vaccineName,
        p_administered_on: parsed.data.administeredOn,
        p_dose: parsed.data.dose,
        p_veterinarian_id: parsed.data.veterinarianId,
        p_weight_kg: parsed.data.weightKg,
        p_next_due_on: parsed.data.nextDueOn,
        p_notes: parsed.data.notes,
      })
    : await supabase.rpc("create_vaccination_record", {
        p_pet_id: parsed.data.petId,
        p_appointment_id: parsed.data.appointmentId,
        p_vaccine_name: parsed.data.vaccineName,
        p_administered_on: parsed.data.administeredOn,
        p_dose: parsed.data.dose,
        p_veterinarian_id: parsed.data.veterinarianId,
        p_weight_kg: parsed.data.weightKg,
        p_next_due_on: parsed.data.nextDueOn,
        p_notes: parsed.data.notes,
      });
  if (error) return { error: rpcMessage(error), values };

  finish(
    clinicalReturnPath(text(formData, "returnTo"), `/staff/pets/${parsed.data.petId}`),
    parsed.data.lineageId ? "vaccination-revised" : "vaccination-saved",
  );
}
