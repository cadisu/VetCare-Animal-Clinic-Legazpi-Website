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

export const SLOT_STATES = ["AVAILABLE", "FULL", "BLOCKED", "UNAVAILABLE", "ALREADY_BOOKED", "EARLIER_TODAY"] as const;
export type SlotState = (typeof SLOT_STATES)[number];

export function slotStateLabel(state: SlotState | string): string {
  if (state === "ALREADY_BOOKED") return "Already booked";
  if (state === "EARLIER_TODAY") return "Earlier today";
  return state;
}

/** Walk-ins can use an earlier open slot from today. On-behalf bookings stay on later times. */
export function isStaffBookableSlot(state: string, source: AppointmentSource): boolean {
  if (state === "AVAILABLE") return true;
  return source === "WALK_IN" && state === "EARLIER_TODAY";
}

export const STATUS_LABELS: Record<AppointmentStatus, string> = {
  PENDING: "Pending",
  CONFIRMED: "Confirmed",
  CHECKED_IN: "Checked In",
  IN_CONSULTATION: "In Consultation",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
  NO_SHOW: "No Show",
};

export function isAppointmentStatus(status: string): status is AppointmentStatus {
  return (APPOINTMENT_STATUSES as readonly string[]).includes(status);
}

/** Readable label for a stored status, including an unknown-status fallback. */
export function statusLabel(status: string): string {
  return isAppointmentStatus(status) ? STATUS_LABELS[status] : "Unknown";
}

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
  schedule_version: number;
  created_at: string;
  client_id: string;
  pet: { id: string; name: string; pet_number: number };
  service: { id: string; name: string; requires_veterinarian: boolean };
  slot: {
    id: string;
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

/** Day lists: open visits first (pending through in consultation), finished visits last, then by time. */
export function compareAppointmentsForDay(a: AppointmentListRow, b: AppointmentListRow): number {
  const aFinished = TERMINAL_STATUSES.includes(a.status) ? 1 : 0;
  const bFinished = TERMINAL_STATUSES.includes(b.status) ? 1 : 0;
  if (aFinished !== bFinished) return aFinished - bFinished;
  return compareAppointmentsBySlotTime(a, b);
}

const RECORDABLE_FOR_SCHEDULE = new Set<AppointmentStatus>(["CHECKED_IN", "IN_CONSULTATION", "COMPLETED"]);

/** Senior Vet day list: waiting for a record, already recorded, or cancelled / no-show. */
export type ScheduleRecordMark = "pending" | "recorded" | "closed";

export function scheduleRecordMark(status: AppointmentStatus, hasRecord: boolean): ScheduleRecordMark | null {
  if (status === "CANCELLED" || status === "NO_SHOW") return "closed";
  if (hasRecord) return "recorded";
  if (RECORDABLE_FOR_SCHEDULE.has(status)) return "pending";
  return null;
}

function scheduleRecordRank(status: AppointmentStatus, hasRecord: boolean): number {
  const mark = scheduleRecordMark(status, hasRecord);
  if (mark === "pending") return 0;
  if (mark === "closed") return 2;
  return 1;
}

/** Pending records first, cancelled and no-shows last, then by appointment time. */
export function compareSeniorVetSchedule(
  a: AppointmentListRow,
  b: AppointmentListRow,
  recordedIds: ReadonlySet<string>,
): number {
  const rank = scheduleRecordRank(a.status, recordedIds.has(a.id)) - scheduleRecordRank(b.status, recordedIds.has(b.id));
  if (rank !== 0) return rank;
  return compareAppointmentsBySlotTime(a, b);
}

export const CLIENT_UPCOMING_PREVIEW_LIMIT = 5;
