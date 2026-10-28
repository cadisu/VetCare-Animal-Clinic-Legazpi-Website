import type { UserRole } from "@/lib/auth/roles";
import type { AppointmentStatus } from "@/lib/appointments/constants";

/**
 * UI mirror of public.transition_appointment_status.
 * The database function is authoritative. Keep the two graphs identical.
 * Confirming PENDING is allowed for staff and senior vet even when the slot
 * requires veterinarian acceptance. That confirmation is the acceptance step.
 */

export const APPOINTMENT_STATUS_ACTIONS = [
  "confirm",
  "check_in",
  "start_consultation",
  "complete",
  "cancel",
  "no_show",
] as const;

export type AppointmentStatusAction = (typeof APPOINTMENT_STATUS_ACTIONS)[number];

export const APPOINTMENT_ACTION_STATUS: Record<AppointmentStatusAction, AppointmentStatus> = {
  confirm: "CONFIRMED",
  check_in: "CHECKED_IN",
  start_consultation: "IN_CONSULTATION",
  complete: "COMPLETED",
  cancel: "CANCELLED",
  no_show: "NO_SHOW",
};

export const APPOINTMENT_ACTION_LABELS: Record<AppointmentStatusAction, string> = {
  confirm: "Confirm appointment",
  check_in: "Mark as checked in",
  start_consultation: "Start consultation",
  complete: "Mark service as finished",
  cancel: "Cancel appointment",
  no_show: "Mark as no-show",
};

const STAFF_ACTIONS: Record<AppointmentStatus, readonly AppointmentStatusAction[]> = {
  PENDING: ["confirm", "cancel"],
  CONFIRMED: ["check_in", "cancel", "no_show"],
  CHECKED_IN: ["start_consultation"],
  IN_CONSULTATION: ["complete"],
  COMPLETED: [],
  CANCELLED: [],
  NO_SHOW: [],
};

const CLIENT_ACTIONS: Record<AppointmentStatus, readonly AppointmentStatusAction[]> = {
  PENDING: ["cancel"],
  CONFIRMED: [],
  CHECKED_IN: [],
  IN_CONSULTATION: [],
  COMPLETED: [],
  CANCELLED: [],
  NO_SHOW: [],
};

export function appointmentStatusActions(
  role: UserRole,
  status: AppointmentStatus,
): readonly AppointmentStatusAction[] {
  if (role === "CLIENT") return CLIENT_ACTIONS[status];
  return STAFF_ACTIONS[status];
}

export function appointmentActionConfirmMessage(action: AppointmentStatusAction): string | null {
  if (action === "cancel") {
    return "Cancel this appointment? This cannot be reversed through the normal workflow.";
  }
  if (action === "no_show") {
    return "Mark this appointment as a no-show? This cannot be reversed through the normal workflow.";
  }
  return null;
}

export type AppointmentTransitionResult =
  | { ok: true }
  | { ok: false; code: "unauthorized" | "invalid" };

/** Same allow/deny rules as the transition RPC, without a database round trip. */
export function evaluateAppointmentTransition(input: {
  role: UserRole | null;
  currentStatus: AppointmentStatus;
  nextStatus: AppointmentStatus;
  isOwner: boolean;
}): AppointmentTransitionResult {
  const { role, currentStatus, nextStatus, isOwner } = input;
  if (role !== "CLIENT" && role !== "STAFF" && role !== "SENIOR_VET") {
    return { ok: false, code: "unauthorized" };
  }

  if (role === "CLIENT") {
    if (!isOwner) return { ok: false, code: "unauthorized" };
    if (currentStatus === "PENDING" && nextStatus === "CANCELLED") return { ok: true };
    return { ok: false, code: "invalid" };
  }

  const allowed = appointmentStatusActions(role, currentStatus).some(
    (action) => APPOINTMENT_ACTION_STATUS[action] === nextStatus,
  );
  return allowed ? { ok: true } : { ok: false, code: "invalid" };
}

export const APPOINTMENT_STATUS_NOTICES: Record<string, string> = {
  confirmed: "Appointment confirmed.",
  checked_in: "Client checked in.",
  consultation_started: "Consultation started.",
  completed: "Appointment marked as completed.",
  already_billed: "This visit is already billed.",
  cancelled: "Appointment cancelled. This cannot be reversed through the normal workflow.",
  no_show: "Appointment marked as a no-show.",
};

export const APPOINTMENT_STATUS_ERRORS: Record<string, string> = {
  unauthorized: "You are not allowed to perform this action.",
  invalid: "This status change is not allowed. Refresh the page and try again.",
  not_found: "Appointment not found.",
  generic: "Something went wrong. Please try again.",
  missing_price: "Set a price for this service before adding it.",
};

const NOTICE_CODE_BY_STATUS: Partial<Record<AppointmentStatus, string>> = {
  CONFIRMED: "confirmed",
  CHECKED_IN: "checked_in",
  IN_CONSULTATION: "consultation_started",
  COMPLETED: "completed",
  CANCELLED: "cancelled",
  NO_SHOW: "no_show",
};

export function appointmentNoticeCode(status: AppointmentStatus): string | null {
  return NOTICE_CODE_BY_STATUS[status] ?? null;
}

export function appointmentStatusNotice(code: string | undefined): string | null {
  if (!code) return null;
  return APPOINTMENT_STATUS_NOTICES[code] ?? null;
}

export function appointmentStatusError(code: string | undefined): string | null {
  if (!code) return null;
  return APPOINTMENT_STATUS_ERRORS[code] ?? APPOINTMENT_STATUS_ERRORS.generic;
}

/** Maps a database exception to a short code. Never returns the raw message. */
export function appointmentTransitionErrorCode(
  message: string,
): "unauthorized" | "invalid" | "not_found" | "generic" {
  if (message.includes("Appointment not found")) return "not_found";
  if (message.includes("Not authorized")) return "unauthorized";
  if (message.includes("Invalid status transition") || message.includes("Invalid reason")) return "invalid";
  return "generic";
}
