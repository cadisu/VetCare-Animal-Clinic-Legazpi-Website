import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { canRescheduleAppointment } from "@/lib/appointments/reschedule";
import { dispatchReminders, type ReminderCandidate } from "@/lib/sms/dispatch";
import { deliverClaimedMessage, type ClaimedSms } from "@/lib/sms/deliver";
import { evaluateManualReminder, manualReminderClaimDate } from "@/lib/sms/manual-reminder";
import { toUnisMsRecipient } from "@/lib/sms/phone";
import { phoneSchema } from "@/lib/validation/common";
import {
  canManuallyRetry,
  classifyGetResponse,
  classifySendResponse,
  parseWebhookBody,
  secretsMatch,
  smsStatusLabel,
  webhookEffect,
} from "@/lib/sms/provider";
import { isReminderEligibleStatus, manilaDateIso, nextManilaDateIso, REMINDER_CRON_UTC } from "@/lib/sms/schedule";
import {
  DEFAULT_REMINDER_TEMPLATE,
  DEFAULT_RESCHEDULE_TEMPLATE,
  describesPendingAsConfirmed,
  reminderTemplateError,
  renderReminderTemplate,
} from "@/lib/sms/template";
import { createUnisMsClient } from "@/lib/sms/unisms";

const migration = readFileSync(
  path.join(process.cwd(), "supabase/migrations/20261016000000_phase5_sms_and_reschedule.sql"),
  "utf8",
);

const claimed: ClaimedSms = {
  id: "sms-1",
  appointmentId: "appt-1",
  content: "Hello",
  recipientPhone: "+639171234567",
  messageType: "APPOINTMENT_REMINDER",
  scheduleVersion: 1,
  retryCount: 0,
  referenceId: null,
};

function candidate(overrides: Partial<ReminderCandidate> = {}): ReminderCandidate {
  return {
    appointment_id: "appt-1",
    client_id: "client-1",
    status: "PENDING",
    schedule_version: 1,
    pet_name: "Mingming",
    service_name: "Wellness check",
    slot_date: "2026-10-17",
    start_time: "09:00:00",
    requires_vet_acceptance: false,
    contact_number: "09171234567",
    sms_id: null,
    sms_status: null,
    failure_class: null,
    ...overrides,
  };
}

const now = new Date("2026-10-16T01:00:00.000Z");

describe("Philippine reminder schedule", () => {
  it("uses 01:00 UTC for 09:00 in Manila", () => {
    expect(REMINDER_CRON_UTC).toBe("0 1 * * *");
    expect(manilaDateIso(now)).toBe("2026-10-16");
    expect(nextManilaDateIso(now)).toBe("2026-10-17");
  });

  it("moves the clinic day at Manila midnight", () => {
    expect(nextManilaDateIso(new Date("2026-10-16T15:59:00.000Z"))).toBe("2026-10-17");
    expect(nextManilaDateIso(new Date("2026-10-16T16:00:00.000Z"))).toBe("2026-10-18");
  });
});

describe("reminder eligibility", () => {
  it("includes pending and confirmed visits only", () => {
    expect(isReminderEligibleStatus("PENDING")).toBe(true);
    expect(isReminderEligibleStatus("CONFIRMED")).toBe(true);
    for (const status of ["CANCELLED", "COMPLETED", "NO_SHOW", "CHECKED_IN", "IN_CONSULTATION"]) {
      expect(isReminderEligibleStatus(status)).toBe(false);
    }
  });

  it("does not describe a pending acceptance visit as confirmed", () => {
    expect(describesPendingAsConfirmed("PENDING", true, "Your visit is confirmed.")).toBe(true);
    expect(describesPendingAsConfirmed("CONFIRMED", true, "Your visit is confirmed.")).toBe(false);
    expect(describesPendingAsConfirmed("PENDING", true, DEFAULT_REMINDER_TEMPLATE)).toBe(false);
  });
});

describe("reminder template", () => {
  it("renders placeholders once and ignores tokens inside values", () => {
    const rendered = renderReminderTemplate(DEFAULT_REMINDER_TEMPLATE, {
      petName: "[Service]",
      serviceName: "Grooming",
      clinicName: "VetCare Veterinary Clinic",
      dateLabel: "October 17, 2026",
      timeLabel: "9:00 AM",
    });
    expect(rendered).toContain("[Service] has a Grooming appointment");
    expect(rendered).not.toContain("[Pet Name]");
    expect(reminderTemplateError(DEFAULT_REMINDER_TEMPLATE)).toBeNull();
  });

  it("accepts the default reschedule template", () => {
    expect(reminderTemplateError(DEFAULT_RESCHEDULE_TEMPLATE)).toBeNull();
    const rendered = renderReminderTemplate(DEFAULT_RESCHEDULE_TEMPLATE, {
      petName: "Max",
      serviceName: "General Checkup",
      clinicName: "VetCare Veterinary Clinic",
      dateLabel: "October 20, 2026",
      timeLabel: "2:30 PM",
    });
    expect(rendered).toBe(
      "Good day! Max's General Checkup appointment at VetCare Veterinary Clinic has been rescheduled to October 20, 2026 at 2:30 PM.",
    );
  });

  it("rejects unknown placeholders and missing required ones", () => {
    expect(reminderTemplateError("Hello [Pet Name] [Service] [Clinic Name] [Date] [Time] [Owner]")).toMatch(/not supported/);
    expect(reminderTemplateError("Hello [Pet Name]")).toMatch(/\[Service\]/);
  });
});

describe("phone numbers", () => {
  it("accepts documented Philippine mobile forms", () => {
    expect(toUnisMsRecipient("09171234567")).toBe("+639171234567");
    expect(toUnisMsRecipient("+639171234567")).toBe("+639171234567");
    expect(toUnisMsRecipient("639171234567")).toBe("+639171234567");
    expect(phoneSchema.parse("9171234567")).toBe("09171234567");
    expect(phoneSchema.parse("09171234567")).toBe("09171234567");
    expect(toUnisMsRecipient("9171234567")).toBe("+639171234567");
  });

  it("rejects numbers that are not mobile", () => {
    expect(toUnisMsRecipient("12345")).toBeNull();
    expect(toUnisMsRecipient(null)).toBeNull();
  });
});

describe("UniSMS responses", () => {
  const pendingBody = JSON.stringify({
    message: {
      status: "pending",
      metadata: { template: "appointment_reminder" },
      content: "Welcome",
      created: "2026-03-16T14:32:44Z",
      recipient: "+639171234567",
      sender_id: "UniSMS",
      reference_id: "msg_84e8b93b-6315-46af-a686",
      fail_reason: null,
    },
  });

  it("keeps an accepted pending message distinct from sent", () => {
    const outcome = classifySendResponse(201, pendingBody, null);
    expect(outcome.kind).toBe("accepted");
    if (outcome.kind === "accepted") {
      expect(outcome.providerStatus).toBe("pending");
      expect(smsStatusLabel("QUEUED", outcome.providerStatus)).toBe("Accepted, pending");
    }
    expect(smsStatusLabel("SENT", "sent")).toBe("Reported sent");
  });

  it("classifies documented send and status codes", () => {
    expect(classifySendResponse(401, "", null).kind).toBe("config");
    expect(classifySendResponse(422, "", null).kind).toBe("validation");
    const limited = classifySendResponse(429, "", "1500");
    expect(limited.kind).toBe("transient");
    if (limited.kind === "transient") expect(limited.retryAfterMs).toBe(1500);
    expect(classifyGetResponse(200, pendingBody.replace("pending", "sent")).kind).toBe("status");
    expect(classifyGetResponse(404, "").kind).toBe("not_found");
  });

  it("uses a mock fetch and never requires live credentials", async () => {
    const calls: string[] = [];
    const client = createUnisMsClient({
      secretKey: "test-secret",
      senderId: "UniSMS",
      fetchImpl: async (url, init) => {
        calls.push(`${init.method} ${url}`);
        const header = new Headers(init.headers);
        expect(header.get("Authorization")).toBe(`Basic ${Buffer.from("test-secret:", "utf8").toString("base64")}`);
        return new Response(pendingBody, { status: 201 });
      },
    });
    const outcome = await client.sendSms({ recipient: "+639171234567", content: "Hello", metadata: { appointment_id: "appt-1" } });
    expect(outcome.kind).toBe("accepted");
    expect(calls).toEqual(["POST https://unismsapi.com/api/sms"]);
  });

  it("records a timeout as uncertain instead of sending again", async () => {
    const client = createUnisMsClient({
      secretKey: "test-secret",
      senderId: "UniSMS",
      fetchImpl: async () => {
        throw new Error("timeout");
      },
    });
    await expect(client.sendSms({ recipient: "+639171234567", content: "Hello" })).resolves.toMatchObject({
      kind: "uncertain",
    });
  });
});

describe("secrets", () => {
  it("rejects missing, empty, and different-length secrets before comparing", () => {
    expect(secretsMatch(undefined, "abc")).toBe(false);
    expect(secretsMatch("abc", null)).toBe(false);
    expect(secretsMatch("abcd", "abc")).toBe(false);
    expect(secretsMatch("cron-secret", "cron-secret")).toBe(true);
    expect(secretsMatch("cron-secret", "cron-secreT")).toBe(false);
  });
});

describe("webhook rules", () => {
  const payload = {
    id: "msg_84e8b93b-6315-46af-a686",
    event: "message.sent",
    message: {
      status: "sent",
      metadata: {},
      content: "Welcome",
      created: "2026-03-16T14:32:44Z",
      recipient: "+639171234567",
      reference_id: "msg_84e8b93b-6315-46af-a686",
      fail_reason: null,
    },
  };

  it("parses a documented delivery", () => {
    const parsed = parseWebhookBody(payload);
    expect(parsed.ok).toBe(true);
  });

  it("does not let a later retrying event regress sent or failed", () => {
    expect(webhookEffect({ status: "SENT", providerStatus: "sent" }, "message.retrying")).toBe("ignore");
    expect(webhookEffect({ status: "FAILED", providerStatus: "failed" }, "message.retrying")).toBe("ignore");
    expect(webhookEffect({ status: "SENT", providerStatus: "sent" }, "message.sent")).toBe("duplicate");
    expect(webhookEffect({ status: "QUEUED", providerStatus: "pending" }, "message.sent")).toBe("apply");
  });
});

describe("retries", () => {
  it("retries a transient failure up to three additional times", async () => {
    let calls = 0;
    const result = await deliverClaimedMessage({
      message: claimed,
      now,
      delay: async () => undefined,
      send: async () => {
        calls += 1;
        return { kind: "transient", error: "down", retryAfterMs: null };
      },
    });
    expect(calls).toBe(4);
    expect(result.failure_class).toBe("transient");
    expect(result.retry_count).toBe(3);
  });

  it("does not treat provider pending as a failed send", async () => {
    const result = await deliverClaimedMessage({
      message: claimed,
      now,
      send: async () => ({
        kind: "accepted",
        providerStatus: "pending",
        referenceId: "msg_1",
        failReason: null,
        response: {},
      }),
    });
    expect(result.internal_status).toBe("QUEUED");
    expect(result.provider_status).toBe("pending");
    expect(result.retry_count).toBe(0);
  });

  it("leaves a configuration failure retryable", async () => {
    const result = await deliverClaimedMessage({
      message: { ...claimed, retryCount: 2 },
      now,
      send: async () => ({ kind: "config", error: "UniSMS rejected the API credentials." }),
    });
    expect(result.failure_class).toBe("config");
    expect(result.retry_count).toBe(2);
    expect(result.outcome_uncertain).toBe(false);
  });

  it("does not retry an uncertain timeout", async () => {
    let calls = 0;
    const result = await deliverClaimedMessage({
      message: claimed,
      now,
      send: async () => {
        calls += 1;
        return { kind: "uncertain", error: "timeout" };
      },
    });
    expect(calls).toBe(1);
    expect(result.outcome_uncertain).toBe(true);
    expect(canManuallyRetry({
      status: "FAILED",
      failureClass: "uncertain",
      outcomeUncertain: true,
      providerStatus: null,
    })).toBe(false);
  });

  it("allows staff retry only for eligible failures", () => {
    expect(canManuallyRetry({ status: "FAILED", failureClass: "config", outcomeUncertain: false, providerStatus: null })).toBe(true);
    expect(canManuallyRetry({ status: "FAILED", failureClass: "validation", outcomeUncertain: false, providerStatus: null })).toBe(false);
    expect(canManuallyRetry({ status: "SENT", failureClass: "none", outcomeUncertain: false, providerStatus: "sent" })).toBe(false);
  });
});

describe("reminder dispatch", () => {
  it("prepares a pending visit and does not send it twice when the claim is taken", async () => {
    const sends: string[] = [];
    let claimedOnce = false;
    const summary = await dispatchReminders({
      now,
      clinicName: "VetCare Veterinary Clinic",
      template: DEFAULT_REMINDER_TEMPLATE,
      providerConfigured: true,
      candidates: [candidate(), candidate({ appointment_id: "appt-2", status: "CONFIRMED", contact_number: "09181234567" })],
      enqueue: async () => undefined,
      listDueIds: async () => ["sms-1", "sms-1"],
      claim: async () => {
        if (claimedOnce) return null;
        claimedOnce = true;
        return claimed;
      },
      assertCurrent: async () => true,
      send: async (message) => {
        sends.push(message.id);
        return { kind: "accepted", providerStatus: "pending", referenceId: "msg_1", failReason: null, response: {} };
      },
      record: async () => undefined,
    });
    expect(sends).toEqual(["sms-1"]);
    expect(summary.prepared).toBe(2);
    expect(summary.accepted).toBe(1);
  });

  it("does not send when credentials are missing and keeps the row retryable", async () => {
    const queued: string[] = [];
    const summary = await dispatchReminders({
      now,
      clinicName: "VetCare Veterinary Clinic",
      template: DEFAULT_REMINDER_TEMPLATE,
      providerConfigured: false,
      candidates: [candidate()],
      enqueue: async (row) => {
        queued.push(row.failureClass);
      },
      listDueIds: async () => {
        throw new Error("should not send");
      },
      claim: async () => claimed,
      assertCurrent: async () => true,
      send: async () => {
        throw new Error("should not send");
      },
      record: async () => undefined,
    });
    expect(queued).toEqual(["config"]);
    expect(summary.configBlocked).toBe(1);
  });

  it("records an invalid phone without sending", async () => {
    const queued: string[] = [];
    await dispatchReminders({
      now,
      clinicName: "VetCare Veterinary Clinic",
      template: DEFAULT_REMINDER_TEMPLATE,
      providerConfigured: true,
      candidates: [candidate({ contact_number: "123" })],
      enqueue: async (row) => {
        queued.push(`${row.status}:${row.failureClass}`);
      },
      listDueIds: async () => [],
      claim: async () => null,
      assertCurrent: async () => true,
      send: async () => ({ kind: "accepted", providerStatus: "sent", referenceId: "msg_1", failReason: null, response: {} }),
      record: async () => undefined,
    });
    expect(queued).toEqual(["FAILED:validation"]);
  });

  it("skips cancelled, completed, and no-show rows", async () => {
    const summary = await dispatchReminders({
      now,
      clinicName: "VetCare Veterinary Clinic",
      template: DEFAULT_REMINDER_TEMPLATE,
      providerConfigured: true,
      candidates: [
        candidate({ status: "CANCELLED" }),
        candidate({ appointment_id: "appt-2", status: "COMPLETED" }),
        candidate({ appointment_id: "appt-3", status: "NO_SHOW" }),
      ],
      enqueue: async () => {
        throw new Error("should not enqueue");
      },
      listDueIds: async () => [],
      claim: async () => null,
      assertCurrent: async () => true,
      send: async () => {
        throw new Error("should not send");
      },
      record: async () => undefined,
    });
    expect(summary.skipped).toBe(3);
  });
});

describe("manual reminder", () => {
  const base = {
    status: "PENDING",
    slotDate: "2026-10-20",
    startTime: "09:00:00",
    nowMs: new Date("2026-10-16T01:00:00.000Z").getTime(),
    clinicName: "VetCare Veterinary Clinic",
    templateError: null,
    providerConfigured: true,
    requiresVetAcceptance: false,
    renderedContent: "Good day! This is a reminder.",
    phoneValid: true,
    existing: null,
  };

  it("allows an early pending reminder and claims the appointment date", () => {
    expect(evaluateManualReminder(base)).toMatchObject({ ok: true, mode: "enqueue" });
    expect(evaluateManualReminder({ ...base, status: "CONFIRMED" })).toMatchObject({ ok: true, mode: "enqueue" });
    expect(manualReminderClaimDate("2026-10-20")).toBe("2026-10-20");
  });

  it("blocks ineligible statuses and an already sent reminder", () => {
    expect(evaluateManualReminder({ ...base, status: "CHECKED_IN" }).ok).toBe(false);
    expect(evaluateManualReminder({ ...base, status: "CANCELLED" }).ok).toBe(false);
    const sent = evaluateManualReminder({
      ...base,
      existing: { id: "sms-1", status: "SENT", failureClass: "none", outcomeUncertain: false, providerStatus: "sent" },
    });
    expect(sent.ok).toBe(false);
  });
});

describe("rescheduling rules", () => {
  it("allows only pending and confirmed appointments", () => {
    expect(canRescheduleAppointment("PENDING")).toBe(true);
    expect(canRescheduleAppointment("CONFIRMED")).toBe(true);
    for (const status of ["COMPLETED", "CANCELLED", "NO_SHOW", "CHECKED_IN", "IN_CONSULTATION"]) {
      expect(canRescheduleAppointment(status)).toBe(false);
    }
  });
});

describe("phase 5 migration contract", () => {
  it("keeps completion and direct appointment updates unchanged", () => {
    expect(migration).not.toContain("function public.mark_appointment_completed");
    expect(migration).not.toContain("grant update on public.appointments");
    expect(migration).toContain("schedule_version = schedule_version + 1");
    expect(migration).toContain("over_capacity = false");
    expect(migration).toContain("unique (appointment_id, schedule_version, message_type)");
    expect(migration).toContain("reschedule_requests_one_pending_idx");
  });

  it("does not let a client approve a request or a webhook change an appointment", () => {
    const submit = migration.slice(migration.indexOf("function public.submit_reschedule_request"), migration.indexOf("function public.withdraw_reschedule_request"));
    expect(submit).not.toContain("update public.appointments");
    expect(submit).toContain("A reschedule request is already pending");
    const approve = migration.slice(migration.indexOf("function public.approve_reschedule_request"), migration.indexOf("function public.reject_reschedule_request"));
    expect(approve).toContain("STAFF");
    expect(approve).toContain("SENIOR_VET");
    expect(approve).not.toContain("'CLIENT'");
    const webhook = migration.slice(migration.indexOf("function public.apply_sms_provider_event"), migration.indexOf("function public.claim_sms_manual_retry"));
    expect(webhook).not.toContain("public.appointments");
    expect(webhook).toContain("message.retrying");
    expect(webhook).toContain("duplicate");
  });
});
