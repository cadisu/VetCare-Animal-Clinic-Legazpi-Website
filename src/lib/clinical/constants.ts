import { formatTime12, type AppointmentStatus } from "@/lib/appointments/constants";
import { formatDate } from "@/lib/dates";

/** Visits that may receive an official clinical or vaccination record. */
export const RECORDABLE_APPOINTMENT_STATUSES = [
  "CHECKED_IN",
  "IN_CONSULTATION",
  "COMPLETED",
] as const satisfies readonly AppointmentStatus[];

export function isRecordableAppointmentStatus(status: string): boolean {
  return (RECORDABLE_APPOINTMENT_STATUSES as readonly string[]).includes(status);
}

export type WeightRecord = {
  id: string;
  pet_id: string;
  appointment_id: string | null;
  weight_kg: number | string;
  recorded_at: string;
  recorded_by: string;
  source: "MANUAL" | "IOT";
};

export type ClinicalRecord = {
  id: string;
  lineage_id: string;
  revision: number;
  is_current: boolean;
  pet_id: string;
  appointment_id: string;
  visit_date: string;
  veterinarian_id: string;
  reason_for_visit: string;
  clinical_notes: string;
  assessment: string;
  treatment: string;
  follow_up: string | null;
  recorded_by: string;
  created_at: string;
  veterinarian: { display_name: string } | null;
};

export type VaccinationRecord = {
  id: string;
  lineage_id: string;
  revision: number;
  is_current: boolean;
  pet_id: string;
  appointment_id: string | null;
  vaccine_name: string;
  administered_on: string;
  dose: string;
  veterinarian_id: string;
  weight_kg: number | string | null;
  next_due_on: string | null;
  notes: string | null;
  recorded_by: string;
  created_at: string;
  veterinarian: { display_name: string } | null;
};

export type RecordableAppointment = {
  id: string;
  status: AppointmentStatus;
  service: { name: string } | null;
  slot: { slot_date: string; start_time: string } | null;
};

export function recordableAppointmentLabel(appointment: RecordableAppointment): string {
  const when = appointment.slot
    ? `${formatDate(appointment.slot.slot_date)} ${formatTime12(appointment.slot.start_time)}`
    : "Visit";
  return `${when} · ${appointment.service?.name ?? "Service"}`;
}

export const CLINICAL_RECORD_SELECT = `
  id, lineage_id, revision, is_current, pet_id, appointment_id, visit_date,
  veterinarian_id, reason_for_visit, clinical_notes, assessment, treatment,
  follow_up, recorded_by, created_at,
  veterinarian:veterinarians ( display_name )
`;

export const VACCINATION_RECORD_SELECT = `
  id, lineage_id, revision, is_current, pet_id, appointment_id, vaccine_name,
  administered_on, dose, veterinarian_id, weight_kg, next_due_on, notes,
  recorded_by, created_at,
  veterinarian:veterinarians ( display_name )
`;

export const WEIGHT_RECORD_SELECT =
  "id, pet_id, appointment_id, weight_kg, recorded_at, recorded_by, source";

export const CLINICAL_NOTICES: Record<string, string> = {
  "weight-saved": "Weight recorded. Earlier readings stay in the history.",
  "clinical-saved": "Clinical record saved.",
  "clinical-revised": "A new clinical revision was saved. The previous version is still in the history.",
  "vaccination-saved": "Vaccination record saved.",
  "vaccination-revised": "A new vaccination revision was saved. The previous version is still in the history.",
};

export function formatWeightKg(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === "") return "—";
  const amount = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(amount)) return "—";
  return `${amount.toFixed(2)} kg`;
}

export type ClinicalLineage<T extends { revision: number; is_current: boolean }> = {
  current: T;
  previous: T[];
};

export function groupRevisions<T extends { id: string; lineage_id: string; revision: number; is_current: boolean }>(
  rows: T[],
): ClinicalLineage<T>[] {
  const groups = new Map<string, T[]>();
  for (const row of rows) {
    const list = groups.get(row.lineage_id) ?? [];
    list.push(row);
    groups.set(row.lineage_id, list);
  }

  return [...groups.values()].map((revisions) => {
    const sorted = [...revisions].sort((a, b) => b.revision - a.revision);
    const current = sorted.find((row) => row.is_current) ?? sorted[0];
    return { current, previous: sorted.filter((row) => row.id !== current.id) };
  });
}
