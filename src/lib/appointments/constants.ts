export const BOOKING_WINDOW_DAYS = 60;

export const APPOINTMENT_SOURCES = ["APPOINTMENT", "WALK_IN"] as const;
export type AppointmentSource = (typeof APPOINTMENT_SOURCES)[number];

export const APPOINTMENT_STATUSES = [
  "PENDING",
  "CONFIRMED",
  "CHECKED_IN",
  "IN_CONSULTATION",
  "COMPLETED",
  "CANCELLED",
  "NO_SHOW",
] as const;
export type AppointmentStatus = (typeof APPOINTMENT_STATUSES)[number];

export const SLOT_STATES = ["AVAILABLE", "FULL", "BLOCKED", "UNAVAILABLE"] as const;
export type SlotState = (typeof SLOT_STATES)[number];

export const STATUS_LABELS: Record<AppointmentStatus, string> = {
  PENDING: "Pending",
  CONFIRMED: "Confirmed",
  CHECKED_IN: "Checked in",
  IN_CONSULTATION: "In consultation",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
  NO_SHOW: "No show",
};

export const SOURCE_LABELS: Record<AppointmentSource, string> = {
  APPOINTMENT: "Appointment",
  WALK_IN: "Walk-in",
};

export type ServiceRow = {
  id: string;
  name: string;
  description: string | null;
  category: string;
  requires_veterinarian: boolean;
  is_active: boolean;
  is_bookable: boolean;
  price: number | null;
  duration_minutes: number | null;
  sort_order: number;
};

export type VeterinarianRow = {
  id: string;
  display_name: string;
  is_active: boolean;
  sort_order: number;
  profile_id: string | null;
};

export type AvailabilityRow = {
  slot_id: string;
  slot_date: string;
  start_time: string;
  capacity: number;
  booked_count: number;
  slot_state: SlotState;
  requires_vet_acceptance: boolean;
};

export type AppointmentListRow = {
  id: string;
  source: AppointmentSource;
  status: AppointmentStatus;
  over_capacity: boolean;
  created_at: string;
  client_id: string;
  pet: { id: string; name: string; pet_number: number };
  service: { id: string; name: string };
  slot: {
    slot_date: string;
    start_time: string;
    requires_vet_acceptance: boolean;
    veterinarian: { id: string; display_name: string } | null;
  };
};

export function formatTime12(time: string): string {
  const [h, m] = time.slice(0, 5).split(":").map(Number);
  const suffix = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 || 12;
  return `${hour12}:${String(m).padStart(2, "0")} ${suffix}`;
}

export function appointmentSlotStartMs(slotDate: string, startTime: string): number {
  return new Date(`${slotDate}T${startTime.slice(0, 5)}:00+08:00`).getTime();
}

const TERMINAL_STATUSES: AppointmentStatus[] = ["CANCELLED", "COMPLETED", "NO_SHOW"];

/** Client upcoming list: exclude terminal statuses and past slot starts. */
export function isClientUpcomingAppointment(
  slotDate: string,
  startTime: string,
  status: AppointmentStatus,
): boolean {
  if (TERMINAL_STATUSES.includes(status)) return false;
  return appointmentSlotStartMs(slotDate, startTime) > Date.now();
}

/** Staff day view: include in-progress visits for roughly the past hour. */
export function isUpcomingAppointment(
  slotDate: string,
  startTime: string,
  status: AppointmentStatus,
): boolean {
  if (TERMINAL_STATUSES.includes(status)) return false;
  return appointmentSlotStartMs(slotDate, startTime) >= Date.now() - 60 * 60 * 1000;
}

export function compareAppointmentsBySlotTime(a: AppointmentListRow, b: AppointmentListRow): number {
  const da = appointmentSlotStartMs(a.slot.slot_date, a.slot.start_time);
  const db = appointmentSlotStartMs(b.slot.slot_date, b.slot.start_time);
  return da - db;
}

/** True when staff may use Mark Service as Finished (UI hint; RPC enforces). */
export function canStaffCompleteAppointment(appointment: AppointmentListRow): boolean {
  if (TERMINAL_STATUSES.includes(appointment.status)) return false;
  if (appointment.slot.requires_vet_acceptance && appointment.status === "PENDING") return false;
  return (
    appointment.status === "PENDING" ||
    appointment.status === "CONFIRMED" ||
    appointment.status === "CHECKED_IN" ||
    appointment.status === "IN_CONSULTATION"
  );
}

export const CLIENT_UPCOMING_PREVIEW_LIMIT = 5;
