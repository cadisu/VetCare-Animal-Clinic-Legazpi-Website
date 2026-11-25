import { z } from "zod";
import { isIsoDate, todayIso } from "@/lib/dates";

const uuid = z.string().trim().uuid("Choose a valid record.");

function pastDate(label: string) {
  return z
    .string()
    .trim()
    .refine((value) => isIsoDate(value), `Enter a valid ${label}.`)
    .refine((value) => value >= "1980-01-01" && value <= todayIso(), `Enter a valid ${label}.`);
}

function futureOrPastDate(label: string) {
  return z
    .string()
    .trim()
    .refine((value) => value === "" || isIsoDate(value), `Enter a valid ${label}.`)
    .transform((value) => (value === "" ? null : value));
}

const weightText = z
  .string()
  .trim()
  .refine((value) => /^\d+(\.\d{1,2})?$/.test(value), "Enter a weight in kilograms.")
  .transform(Number)
  .refine((value) => value >= 0.01 && value <= 200, "Enter a weight between 0.01 and 200 kg.");

export const optionalWeight = z
  .string()
  .trim()
  .refine((value) => value === "" || /^\d+(\.\d{1,2})?$/.test(value), "Enter a weight in kilograms.")
  .transform((value) => (value === "" ? null : Number(value)))
  .refine((value) => value === null || (value >= 0.01 && value <= 200), "Enter a weight between 0.01 and 200 kg.");

/** Empty means the consultation starts with no new reading. A filled value must be 0.01 to 200 kg. */
export function parseConsultationWeight(
  value: string,
): { ok: true; kg: number | null } | { ok: false; message: string } {
  const parsed = optionalWeight.safeParse(value);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Enter a weight between 0.01 and 200 kg." };
  }
  return { ok: true, kg: parsed.data };
}

export const weightSchema = z.object({
  petId: uuid,
  appointmentId: z
    .string()
    .trim()
    .refine((value) => value === "" || z.string().uuid().safeParse(value).success, "Choose a valid visit.")
    .transform((value) => (value === "" ? null : value)),
  weightKg: weightText,
});

export const clinicalRecordSchema = z.object({
  petId: uuid,
  appointmentId: uuid,
  lineageId: z
    .string()
    .trim()
    .refine((value) => value === "" || z.string().uuid().safeParse(value).success, "Choose a valid record.")
    .transform((value) => (value === "" ? null : value)),
  visitDate: pastDate("visit date"),
  veterinarianId: uuid,
  reasonForVisit: z.string().trim().min(1, "Enter a reason for the visit.").max(500, "Reason is too long."),
  clinicalNotes: z.string().trim().min(1, "Enter the clinical notes.").max(4000, "Clinical notes are too long."),
  assessment: z.string().trim().min(1, "Enter the assessment.").max(4000, "Assessment is too long."),
  treatment: z.string().trim().min(1, "Enter the treatment.").max(4000, "Treatment is too long."),
  followUp: z
    .string()
    .trim()
    .max(2000, "Follow-up instructions are too long.")
    .transform((value) => (value === "" ? null : value)),
});

export const vaccinationSchema = z
  .object({
    petId: uuid,
    appointmentId: z
      .string()
      .trim()
      .refine((value) => value === "" || z.string().uuid().safeParse(value).success, "Choose a valid visit.")
      .transform((value) => (value === "" ? null : value)),
    lineageId: z
      .string()
      .trim()
      .refine((value) => value === "" || z.string().uuid().safeParse(value).success, "Choose a valid record.")
      .transform((value) => (value === "" ? null : value)),
    vaccineName: z.string().trim().min(1, "Enter the vaccine name.").max(120, "Vaccine name is too long."),
    administeredOn: pastDate("vaccination date"),
    dose: z.string().trim().min(1, "Enter the dose.").max(80, "Dose is too long."),
    veterinarianId: uuid,
    weightKg: optionalWeight,
    nextDueOn: futureOrPastDate("next vaccination date"),
    notes: z
      .string()
      .trim()
      .max(2000, "Notes are too long.")
      .transform((value) => (value === "" ? null : value)),
  })
  .superRefine((value, ctx) => {
    if (value.nextDueOn && value.nextDueOn < value.administeredOn) {
      ctx.addIssue({
        code: "custom",
        path: ["nextDueOn"],
        message: "Next vaccination date cannot be before the dose was given.",
      });
    }
  });

export type WeightInput = z.infer<typeof weightSchema>;
export type ClinicalRecordInput = z.infer<typeof clinicalRecordSchema>;
export type VaccinationInput = z.infer<typeof vaccinationSchema>;

const SAFE_RETURN_PREFIXES = ["/staff/pets/", "/staff/appointments/", "/senior-vet/appointments/"];

/** Keeps a successful save on a clinic page and drops external redirect targets. */
export function clinicalReturnPath(value: string, fallback: string): string {
  const path = value.split("?")[0]?.split("#")[0] ?? "";
  if (!path.startsWith("/") || path.startsWith("//")) return fallback;
  if (!SAFE_RETURN_PREFIXES.some((prefix) => path.startsWith(prefix))) return fallback;
  return path;
}
