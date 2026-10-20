import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  CLINICAL_RECORD_SELECT,
  RECORDABLE_APPOINTMENT_STATUSES,
  VACCINATION_RECORD_SELECT,
  WEIGHT_RECORD_SELECT,
  type ClinicalRecord,
  type RecordableAppointment,
  type VaccinationRecord,
  type WeightRecord,
} from "./constants";

export async function listWeightRecords(supabase: SupabaseClient, petId: string): Promise<WeightRecord[]> {
  const { data } = await supabase
    .from("pet_weight_records")
    .select(WEIGHT_RECORD_SELECT)
    .eq("pet_id", petId)
    .order("recorded_at", { ascending: false });
  return (data ?? []) as WeightRecord[];
}

export async function listClinicalRecords(supabase: SupabaseClient, petId: string): Promise<ClinicalRecord[]> {
  const { data } = await supabase
    .from("clinical_records")
    .select(CLINICAL_RECORD_SELECT)
    .eq("pet_id", petId)
    .order("visit_date", { ascending: false })
    .order("revision", { ascending: false });
  return (data ?? []) as unknown as ClinicalRecord[];
}

export async function listVaccinationRecords(
  supabase: SupabaseClient,
  petId: string,
): Promise<VaccinationRecord[]> {
  const { data } = await supabase
    .from("vaccination_records")
    .select(VACCINATION_RECORD_SELECT)
    .eq("pet_id", petId)
    .order("administered_on", { ascending: false })
    .order("revision", { ascending: false });
  return (data ?? []) as unknown as VaccinationRecord[];
}

export async function listRecordableAppointments(
  supabase: SupabaseClient,
  petId: string,
): Promise<RecordableAppointment[]> {
  const { data } = await supabase
    .from("appointments")
    .select(
      `
      id, status,
      service:services!appointments_service_id_fkey ( name ),
      slot:appointment_slots!appointments_slot_id_fkey ( slot_date, start_time )
    `,
    )
    .eq("pet_id", petId)
    .in("status", [...RECORDABLE_APPOINTMENT_STATUSES]);
  return (data ?? []) as unknown as RecordableAppointment[];
}
