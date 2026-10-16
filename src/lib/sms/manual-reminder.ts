import { appointmentSlotStartMs } from "@/lib/appointments/constants";
import { describesPendingAsConfirmed } from "@/lib/sms/template";

export type ExistingReminder = {
  id: string;
  status: string;
  failureClass: string | null;
  outcomeUncertain: boolean;
  providerStatus: string | null;
};

export type ManualReminderInput = {
  status: string;
  slotDate: string;
  startTime: string;
  nowMs: number;
  clinicName: string;
  templateError: string | null;
  providerConfigured: boolean;
  requiresVetAcceptance: boolean;
  renderedContent: string;
  phoneValid: boolean;
  existing: ExistingReminder | null;
};

export type ManualReminderDecision =
  | { ok: true; mode: "enqueue" | "claim" | "retry"; smsId: string | null }
  | { ok: false; reason: string };

/** Pure rules for the staff "send reminder now" button. Cron still targets tomorrow only. */
export function evaluateManualReminder(input: ManualReminderInput): ManualReminderDecision {
  if (input.status !== "PENDING" && input.status !== "CONFIRMED") {
    return { ok: false, reason: "Only pending and confirmed appointments can receive a reminder." };
  }
  if (appointmentSlotStartMs(input.slotDate, input.startTime) <= input.nowMs) {
    return { ok: false, reason: "This appointment has already started." };
  }
  if (input.existing?.status === "SENT" || input.existing?.status === "QUEUED") {
    return { ok: false, reason: "A reminder for this schedule is already sent or waiting with the provider." };
  }
  if (input.existing?.outcomeUncertain) {
    return { ok: false, reason: "The last reminder outcome is uncertain, so it was not sent again." };
  }
  if (input.existing?.status === "FAILED" && input.existing.failureClass === "validation") {
    return { ok: false, reason: "This reminder failed validation. Fix the phone number or message before trying again." };
  }
  if (
    input.existing?.providerStatus === "pending" ||
    input.existing?.providerStatus === "retrying" ||
    input.existing?.providerStatus === "sent"
  ) {
    return { ok: false, reason: "The provider already accepted a reminder for this schedule." };
  }
  if (!input.providerConfigured) {
    return { ok: false, reason: "SMS provider is not configured." };
  }
  if (!input.clinicName.trim()) {
    return { ok: false, reason: "Clinic name is not configured." };
  }
  if (input.templateError) {
    return { ok: false, reason: input.templateError };
  }
  if (describesPendingAsConfirmed(input.status, input.requiresVetAcceptance, input.renderedContent)) {
    return { ok: false, reason: "This reminder would describe a pending appointment as confirmed." };
  }
  if (!input.phoneValid) {
    return { ok: false, reason: "The client does not have a valid Philippine mobile number." };
  }

  if (
    input.existing &&
    input.existing.status === "FAILED" &&
    (input.existing.failureClass === "config" || input.existing.failureClass === "transient")
  ) {
    return { ok: true, mode: "retry", smsId: input.existing.id };
  }
  if (input.existing?.status === "PENDING") {
    return { ok: true, mode: "claim", smsId: input.existing.id };
  }
  return { ok: true, mode: "enqueue", smsId: null };
}

/** Claim date for an early reminder is the appointment day, not only tomorrow. */
export function manualReminderClaimDate(slotDate: string): string {
  return slotDate.slice(0, 10);
}
