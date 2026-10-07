import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { todayIso } from "@/lib/dates";
import {
  BOOKING_WINDOW_DAYS,
  CLIENT_UPCOMING_PREVIEW_LIMIT,
  compareAppointmentsBySlotTime,
  isClientUpcomingAppointment,
  type AppointmentListRow,
  type AvailabilityRow,
  type ServiceRow,
  type VeterinarianRow,
} from "./constants";

export const APPOINTMENT_LIST_SELECT = `
  id, source, status, over_capacity, created_at, client_id,
  pet:pets!appointments_pet_id_fkey ( id, name, pet_number ),
  service:services!appointments_service_id_fkey ( id, name ),
  slot:appointment_slots!appointments_slot_id_fkey (
    slot_date, start_time, requires_vet_acceptance,
    veterinarian:veterinarians ( id, display_name )
  )
`;

export async function listBookableServices(supabase: SupabaseClient): Promise<ServiceRow[]> {
  const { data } = await supabase
    .from("services")
    .select(
      "id, name, description, category, requires_veterinarian, is_active, is_bookable, price, duration_minutes, sort_order",
    )
    .eq("is_active", true)
    .eq("is_bookable", true)
    .order("sort_order", { ascending: true });
  return (data ?? []) as ServiceRow[];
}

export async function listActiveVeterinarians(supabase: SupabaseClient): Promise<VeterinarianRow[]> {
  const { data } = await supabase
    .from("veterinarians")
    .select("id, display_name, is_active, sort_order, profile_id")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });
  return (data ?? []) as VeterinarianRow[];
}

export function bookingDateRange(): { from: string; to: string } {
  const from = todayIso();
  const end = new Date(`${from}T12:00:00Z`);
  end.setUTCDate(end.getUTCDate() + BOOKING_WINDOW_DAYS);
  const to = end.toISOString().slice(0, 10);
  return { from, to };
}

export async function fetchAvailability(
  supabase: SupabaseClient,
  serviceId: string,
  veterinarianId: string | null,
  from?: string,
  to?: string,
): Promise<AvailabilityRow[]> {
  const range = bookingDateRange();
  const { data, error } = await supabase.rpc("get_availability", {
    p_service_id: serviceId,
    p_veterinarian_id: veterinarianId,
    p_from: from ?? range.from,
    p_to: to ?? range.to,
  });
  if (error) throw error;
  return (data ?? []) as AvailabilityRow[];
}

export async function listAppointmentsForClient(
  supabase: SupabaseClient,
  clientId: string,
): Promise<AppointmentListRow[]> {
  const { data } = await supabase
    .from("appointments")
    .select(APPOINTMENT_LIST_SELECT)
    .eq("client_id", clientId)
    .order("created_at", { ascending: false });
  return (data ?? []) as unknown as AppointmentListRow[];
}

export function splitClientAppointments(appointments: AppointmentListRow[]) {
  const upcoming = appointments
    .filter((a) => isClientUpcomingAppointment(a.slot.slot_date, a.slot.start_time, a.status))
    .sort(compareAppointmentsBySlotTime);
  const upcomingSet = new Set(upcoming.map((a) => a.id));
  const history = appointments
    .filter((a) => !upcomingSet.has(a.id))
    .sort((a, b) => compareAppointmentsBySlotTime(b, a));
  return {
    upcoming,
    upcomingPreview: upcoming.slice(0, CLIENT_UPCOMING_PREVIEW_LIMIT),
    history,
  };
}

/** profiles.id → veterinarians.profile_id → veterinarians.id (assigned vet on appointment_slots). */
export async function getVeterinarianIdForProfile(
  supabase: SupabaseClient,
  profileId: string,
): Promise<string | null> {
  const { data: vet } = await supabase
    .from("veterinarians")
    .select("id")
    .eq("profile_id", profileId)
    .maybeSingle();
  return vet?.id ?? null;
}

const SLOT_ID_PAGE_SIZE = 1000;
const APPOINTMENTS_IN_CHUNK = 150;

type AppointmentListRowWithClient = AppointmentListRow & { client?: { full_name: string } };

async function listSlotIdsForVeterinarianFromDate(
  supabase: SupabaseClient,
  veterinarianId: string,
  fromDate: string,
): Promise<string[]> {
  const ids: string[] = [];
  let from = 0;
  for (;;) {
    const to = from + SLOT_ID_PAGE_SIZE - 1;
    const { data, error } = await supabase
      .from("appointment_slots")
      .select("id")
      .eq("veterinarian_id", veterinarianId)
      .gte("slot_date", fromDate)
      .order("slot_date", { ascending: true })
      .order("start_time", { ascending: true })
      .range(from, to);
    if (error) throw error;
    const page = (data ?? []).map((s) => s.id);
    ids.push(...page);
    if (page.length < SLOT_ID_PAGE_SIZE) break;
    from += SLOT_ID_PAGE_SIZE;
  }
  return ids;
}

async function listAppointmentsForSlotIds(
  supabase: SupabaseClient,
  slotIds: string[],
): Promise<AppointmentListRowWithClient[]> {
  const rows: AppointmentListRowWithClient[] = [];
  for (let i = 0; i < slotIds.length; i += APPOINTMENTS_IN_CHUNK) {
    const chunk = slotIds.slice(i, i + APPOINTMENTS_IN_CHUNK);
    const { data, error } = await supabase
      .from("appointments")
      .select(`${APPOINTMENT_LIST_SELECT}, client:profiles!appointments_client_id_fkey ( full_name )`)
      .in("slot_id", chunk);
    if (error) throw error;
    rows.push(...((data ?? []) as unknown as AppointmentListRowWithClient[]));
  }
  return rows;
}

export async function listUpcomingAppointmentsForVeterinarianProfile(
  supabase: SupabaseClient,
  profileId: string,
): Promise<AppointmentListRowWithClient[]> {
  const veterinarianId = await getVeterinarianIdForProfile(supabase, profileId);
  if (!veterinarianId) return [];

  const slotIds = await listSlotIdsForVeterinarianFromDate(supabase, veterinarianId, todayIso());
  if (slotIds.length === 0) return [];

  const rows = await listAppointmentsForSlotIds(supabase, slotIds);

  return rows
    .filter((a) => isClientUpcomingAppointment(a.slot.slot_date, a.slot.start_time, a.status))
    .sort(compareAppointmentsBySlotTime);
}

export async function listAppointmentsForDay(
  supabase: SupabaseClient,
  day: string,
  filters?: { q?: string; source?: string },
): Promise<(AppointmentListRow & { client?: { full_name: string } })[]> {
  const { data: slots } = await supabase
    .from("appointment_slots")
    .select("id")
    .eq("slot_date", day);
  const slotIds = (slots ?? []).map((s) => s.id);
  if (slotIds.length === 0) return [];

  let query = supabase
    .from("appointments")
    .select(`${APPOINTMENT_LIST_SELECT}, client:profiles!appointments_client_id_fkey ( full_name )`)
    .in("slot_id", slotIds);

  if (filters?.source) query = query.eq("source", filters.source);

  const { data } = await query.order("created_at", { ascending: true });
  let rows = (data ?? []) as unknown as (AppointmentListRow & {
    client?: { full_name: string };
  })[];

  if (filters?.q) {
    const q = filters.q.toLowerCase();
    rows = rows.filter(
      (r) =>
        r.pet.name.toLowerCase().includes(q) ||
        r.client?.full_name?.toLowerCase().includes(q) ||
        r.service.name.toLowerCase().includes(q),
    );
  }
  return rows;
}

export async function getAppointmentById(
  supabase: SupabaseClient,
  appointmentId: string,
): Promise<AppointmentListRow | null> {
  const { data } = await supabase
    .from("appointments")
    .select(APPOINTMENT_LIST_SELECT)
    .eq("id", appointmentId)
    .maybeSingle();
  return (data as unknown as AppointmentListRow) ?? null;
}

export async function listAppointmentsForPet(
  supabase: SupabaseClient,
  petId: string,
): Promise<AppointmentListRow[]> {
  const { data } = await supabase
    .from("appointments")
    .select(APPOINTMENT_LIST_SELECT)
    .eq("pet_id", petId)
    .order("created_at", { ascending: false })
    .limit(20);
  return (data ?? []) as unknown as AppointmentListRow[];
}
