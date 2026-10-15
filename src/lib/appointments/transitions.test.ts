import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  APPOINTMENT_STATUSES,
  STATUS_LABELS,
  isClientUpcomingAppointment,
  statusLabel,
  type AppointmentStatus,
} from "@/lib/appointments/constants";
import {
  APPOINTMENT_ACTION_LABELS,
  APPOINTMENT_ACTION_STATUS,
  APPOINTMENT_STATUS_ERRORS,
  appointmentActionConfirmMessage,
  appointmentStatusActions,
  appointmentStatusError,
  appointmentStatusNotice,
  appointmentTransitionErrorCode,
  evaluateAppointmentTransition,
  type AppointmentStatusAction,
} from "@/lib/appointments/transitions";
import type { UserRole } from "@/lib/auth/roles";

const migration = readFileSync(
  path.join(process.cwd(), "supabase/migrations/20261015000000_phase4_appointment_status_workflow.sql"),
  "utf8",
);

const REQUIRED_LABELS: Record<AppointmentStatus, string> = {
  PENDING: "Pending",
  CONFIRMED: "Confirmed",
  CHECKED_IN: "Checked In",
  IN_CONSULTATION: "In Consultation",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
  NO_SHOW: "No Show",
};

function allow(
  role: UserRole | null,
  currentStatus: AppointmentStatus,
  nextStatus: AppointmentStatus,
  isOwner = true,
) {
  return evaluateAppointmentTransition({ role, currentStatus, nextStatus, isOwner });
}

describe("status labels", () => {
  it("uses the required label for every status", () => {
    for (const status of APPOINTMENT_STATUSES) {
      expect(STATUS_LABELS[status]).toBe(REQUIRED_LABELS[status]);
      expect(statusLabel(status)).toBe(REQUIRED_LABELS[status]);
    }
  });

  it("falls back safely for an unknown status", () => {
    expect(statusLabel("RESCHEDULED")).toBe("Unknown");
  });
});

describe("allowed transitions", () => {
  const staffFlow: Array<[AppointmentStatus, AppointmentStatus]> = [
    ["PENDING", "CONFIRMED"],
    ["CONFIRMED", "CHECKED_IN"],
    ["CHECKED_IN", "IN_CONSULTATION"],
    ["IN_CONSULTATION", "COMPLETED"],
    ["PENDING", "CANCELLED"],
    ["CONFIRMED", "CANCELLED"],
    ["CONFIRMED", "NO_SHOW"],
  ];

  it.each(["STAFF", "SENIOR_VET"] as const)("%s can perform each operational transition", (role) => {
    for (const [currentStatus, nextStatus] of staffFlow) {
      expect(allow(role, currentStatus, nextStatus).ok).toBe(true);
    }
  });

  it("lets the owning client cancel a pending appointment", () => {
    expect(allow("CLIENT", "PENDING", "CANCELLED", true)).toEqual({ ok: true });
  });

  it("lets staff confirm an appointment that still requires veterinarian acceptance", () => {
    expect(allow("STAFF", "PENDING", "CONFIRMED").ok).toBe(true);
    expect(allow("SENIOR_VET", "PENDING", "CONFIRMED").ok).toBe(true);
  });
});

describe("rejected transitions", () => {
  const skips: Array<[AppointmentStatus, AppointmentStatus]> = [
    ["PENDING", "CHECKED_IN"],
    ["PENDING", "IN_CONSULTATION"],
    ["PENDING", "COMPLETED"],
    ["PENDING", "NO_SHOW"],
    ["CONFIRMED", "IN_CONSULTATION"],
    ["CONFIRMED", "COMPLETED"],
    ["CHECKED_IN", "COMPLETED"],
    ["IN_CONSULTATION", "CONFIRMED"],
  ];

  it.each(skips)("rejects %s -> %s", (currentStatus, nextStatus) => {
    expect(allow("STAFF", currentStatus, nextStatus)).toEqual({ ok: false, code: "invalid" });
    expect(allow("SENIOR_VET", currentStatus, nextStatus)).toEqual({ ok: false, code: "invalid" });
  });

  it.each(["COMPLETED", "CANCELLED", "NO_SHOW"] as const)(
    "does not reopen a %s appointment",
    (currentStatus) => {
      for (const nextStatus of APPOINTMENT_STATUSES) {
        expect(allow("STAFF", currentStatus, nextStatus).ok).toBe(false);
        expect(allow("SENIOR_VET", currentStatus, nextStatus).ok).toBe(false);
        expect(allow("CLIENT", currentStatus, nextStatus).ok).toBe(false);
      }
    },
  );

  it("rejects a repeated completion", () => {
    expect(allow("STAFF", "COMPLETED", "COMPLETED")).toEqual({ ok: false, code: "invalid" });
  });

  it("rejects client operational changes and cross-client cancellation", () => {
    expect(allow("CLIENT", "PENDING", "CONFIRMED")).toEqual({ ok: false, code: "invalid" });
    expect(allow("CLIENT", "CONFIRMED", "CHECKED_IN")).toEqual({ ok: false, code: "invalid" });
    expect(allow("CLIENT", "CHECKED_IN", "IN_CONSULTATION")).toEqual({ ok: false, code: "invalid" });
    expect(allow("CLIENT", "IN_CONSULTATION", "COMPLETED")).toEqual({ ok: false, code: "invalid" });
    expect(allow("CLIENT", "CONFIRMED", "NO_SHOW")).toEqual({ ok: false, code: "invalid" });
    expect(allow("CLIENT", "CONFIRMED", "CANCELLED")).toEqual({ ok: false, code: "invalid" });
    expect(allow("CLIENT", "PENDING", "CANCELLED", false)).toEqual({ ok: false, code: "unauthorized" });
  });

  it("rejects an unauthorized role", () => {
    expect(allow(null, "PENDING", "CONFIRMED")).toEqual({ ok: false, code: "unauthorized" });
  });

  it("does not let a pending vet-acceptance appointment skip to completed", () => {
    expect(allow("STAFF", "PENDING", "COMPLETED")).toEqual({ ok: false, code: "invalid" });
  });
});

describe("visible actions", () => {
  const expected: Record<AppointmentStatus, AppointmentStatusAction[]> = {
    PENDING: ["confirm", "cancel"],
    CONFIRMED: ["check_in", "cancel", "no_show"],
    CHECKED_IN: ["start_consultation"],
    IN_CONSULTATION: ["complete"],
    COMPLETED: [],
    CANCELLED: [],
    NO_SHOW: [],
  };

  it.each(["STAFF", "SENIOR_VET"] as const)("shows only valid %s actions", (role) => {
    for (const status of APPOINTMENT_STATUSES) {
      expect(appointmentStatusActions(role, status)).toEqual(expected[status]);
    }
  });

  it("shows a client only pending cancellation", () => {
    expect(appointmentStatusActions("CLIENT", "PENDING")).toEqual(["cancel"]);
    for (const status of APPOINTMENT_STATUSES.filter((status) => status !== "PENDING")) {
      expect(appointmentStatusActions("CLIENT", status)).toEqual([]);
    }
  });

  it("asks for confirmation before cancel and no-show", () => {
    expect(appointmentActionConfirmMessage("cancel")).toMatch(/cannot be reversed/i);
    expect(appointmentActionConfirmMessage("no_show")).toMatch(/cannot be reversed/i);
    expect(appointmentActionConfirmMessage("confirm")).toBeNull();
    expect(APPOINTMENT_ACTION_LABELS.complete).toBe("Mark service as finished");
    expect(APPOINTMENT_ACTION_STATUS.complete).toBe("COMPLETED");
  });
});

describe("upcoming appointments", () => {
  it("keeps a future pending visit and drops terminal statuses", () => {
    expect(isClientUpcomingAppointment("2099-01-01", "09:00:00", "PENDING")).toBe(true);
    expect(isClientUpcomingAppointment("2099-01-01", "09:00:00", "CONFIRMED")).toBe(true);
    expect(isClientUpcomingAppointment("2099-01-01", "09:00:00", "CANCELLED")).toBe(false);
    expect(isClientUpcomingAppointment("2099-01-01", "09:00:00", "COMPLETED")).toBe(false);
    expect(isClientUpcomingAppointment("2099-01-01", "09:00:00", "NO_SHOW")).toBe(false);
  });

  it("does not treat a past slot as upcoming", () => {
    expect(isClientUpcomingAppointment("2000-01-01", "09:00:00", "PENDING")).toBe(false);
  });
});

describe("safe error text", () => {
  it("maps database exceptions to short codes and hides the original message", () => {
    expect(appointmentTransitionErrorCode("Not authorized")).toBe("unauthorized");
    expect(appointmentTransitionErrorCode("Invalid status transition")).toBe("invalid");
    expect(appointmentTransitionErrorCode("Appointment not found")).toBe("not_found");
    expect(appointmentTransitionErrorCode('duplicate key value violates unique constraint "appointments_pkey"')).toBe(
      "generic",
    );

    expect(appointmentStatusError("invalid")).toBe(APPOINTMENT_STATUS_ERRORS.invalid);
    expect(appointmentStatusError("drop table appointments")).toBe(APPOINTMENT_STATUS_ERRORS.generic);
    expect(appointmentStatusError("drop table appointments")).not.toMatch(/drop table/i);
    expect(appointmentStatusNotice("confirmed")).toBe("Appointment confirmed.");
    expect(appointmentStatusNotice("select * from appointments")).toBeNull();
  });
});

describe("migration contract", () => {
  it("locks the row, audits in the same function, and keeps completion on the transition RPC", () => {
    expect(migration).toMatch(/for update/i);
    expect(migration).toContain("insert into public.appointment_status_events");
    expect(migration).toContain("perform public.transition_appointment_status(p_appointment_id, 'COMPLETED', null)");
    expect(migration).toContain("security definer");
    expect(migration).toContain("set search_path = public");
    expect(migration).toContain("grant select on public.appointment_status_events to authenticated");
    expect(migration).not.toMatch(/grant update on public\.appointments/i);
    expect(migration).not.toMatch(/grant insert on public\.appointment_status_events/i);
  });

  it("encodes the strict graph and rejects client writes to the audit log", () => {
    expect(migration).toContain("v_appt.status = 'PENDING' and p_next_status in ('CONFIRMED', 'CANCELLED')");
    expect(migration).toContain("v_appt.status = 'CONFIRMED' and p_next_status in ('CHECKED_IN', 'CANCELLED', 'NO_SHOW')");
    expect(migration).toContain("v_appt.status = 'CHECKED_IN' and p_next_status = 'IN_CONSULTATION'");
    expect(migration).toContain("v_appt.status = 'IN_CONSULTATION' and p_next_status = 'COMPLETED'");
    expect(migration).toContain("v_appt.status = 'PENDING' and p_next_status = 'CANCELLED'");
    expect(migration).toContain("Cancelled by client");
    expect(migration).toContain("raise exception 'Invalid status transition'");
    expect(migration).toContain("raise exception 'Not authorized'");
  });
});
