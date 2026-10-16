import { formatDate } from "@/lib/dates";
import { formatTime12 } from "@/lib/appointments/constants";
import { toUnisMsRecipient } from "@/lib/sms/phone";
import type { ClaimedSms, SmsRecordPayload } from "@/lib/sms/deliver";
import { deliverClaimedMessage } from "@/lib/sms/deliver";
import {
  describesPendingAsConfirmed,
  reminderTemplateError,
  renderedMessageError,
  renderReminderTemplate,
} from "@/lib/sms/template";
import { isReminderEligibleStatus, nextManilaDateIso } from "@/lib/sms/schedule";

export type ReminderCandidate = {
  appointment_id: string;
  client_id: string;
  status: string;
  schedule_version: number;
  pet_name: string;
  service_name: string;
  slot_date: string;
  start_time: string;
  requires_vet_acceptance: boolean;
  contact_number: string | null;
  sms_id: string | null;
  sms_status: string | null;
  failure_class: string | null;
};

export type EnqueueSmsInput = {
  appointmentId: string;
  messageType: "APPOINTMENT_REMINDER";
  content: string;
  recipientPhone: string;
  status: "PENDING" | "FAILED";
  failureClass: "none" | "config" | "validation";
  errorDetail: string | null;
};

export type DispatchSummary = {
  prepared: number;
  configBlocked: number;
  accepted: number;
  reportedSent: number;
  failed: number;
  skipped: number;
};

function configEnqueue(candidate: ReminderCandidate, detail: string): EnqueueSmsInput {
  return {
    appointmentId: candidate.appointment_id,
    messageType: "APPOINTMENT_REMINDER",
    content: detail.slice(0, 670),
    recipientPhone: candidate.contact_number?.trim() || "invalid",
    status: "FAILED",
    failureClass: "config",
    errorDetail: detail,
  };
}

export async function dispatchReminders(input: {
  now: Date;
  clinicName: string;
  template: string | null;
  providerConfigured: boolean;
  candidates: ReminderCandidate[];
  enqueue: (row: EnqueueSmsInput) => Promise<void>;
  listDueIds: () => Promise<string[]>;
  claim: (id: string) => Promise<ClaimedSms | null>;
  assertCurrent: (id: string) => Promise<boolean>;
  send: (message: ClaimedSms) => Promise<import("@/lib/sms/provider").SmsSendOutcome>;
  record: (id: string, result: SmsRecordPayload) => Promise<void>;
  delay?: (ms: number) => Promise<void>;
}): Promise<DispatchSummary> {
  const summary: DispatchSummary = {
    prepared: 0,
    configBlocked: 0,
    accepted: 0,
    reportedSent: 0,
    failed: 0,
    skipped: 0,
  };
  const targetDate = nextManilaDateIso(input.now);
  const clinicName = input.clinicName.trim();
  const templateError = input.template ? reminderTemplateError(input.template) : "Reminder template is not configured.";

  for (const candidate of input.candidates) {
    if (!isReminderEligibleStatus(candidate.status) || candidate.slot_date !== targetDate) {
      summary.skipped += 1;
      continue;
    }
    if (candidate.sms_status === "SENT" || candidate.sms_status === "QUEUED" || candidate.sms_status === "CANCELLED") {
      summary.skipped += 1;
      continue;
    }
    if (candidate.sms_status === "FAILED" && candidate.failure_class === "validation") {
      summary.skipped += 1;
      continue;
    }
    if (candidate.sms_status === "FAILED" && candidate.failure_class === "uncertain") {
      summary.skipped += 1;
      continue;
    }
    if (candidate.sms_status === "FAILED" && candidate.failure_class === "transient") {
      summary.skipped += 1;
      continue;
    }
    if (candidate.sms_status === "PENDING" && input.providerConfigured && clinicName && !templateError) {
      summary.skipped += 1;
      continue;
    }

    if (!input.providerConfigured) {
      await input.enqueue(configEnqueue(candidate, "SMS provider is not configured."));
      summary.configBlocked += 1;
      continue;
    }
    if (!clinicName) {
      await input.enqueue(configEnqueue(candidate, "Clinic name is not configured."));
      summary.configBlocked += 1;
      continue;
    }
    if (!input.template || templateError) {
      await input.enqueue(configEnqueue(candidate, templateError ?? "Reminder template is not configured."));
      summary.configBlocked += 1;
      continue;
    }

    const content = renderReminderTemplate(input.template, {
      petName: candidate.pet_name,
      serviceName: candidate.service_name,
      clinicName,
      dateLabel: formatDate(candidate.slot_date),
      timeLabel: formatTime12(candidate.start_time),
    });
    const lengthError = renderedMessageError(content);
    if (lengthError) {
      await input.enqueue({
        ...configEnqueue(candidate, lengthError),
        failureClass: "validation",
        content: lengthError,
      });
      summary.failed += 1;
      continue;
    }
    if (describesPendingAsConfirmed(candidate.status, candidate.requires_vet_acceptance, content)) {
      await input.enqueue(
        configEnqueue(
          candidate,
          "This reminder would describe a pending appointment as confirmed.",
        ),
      );
      summary.configBlocked += 1;
      continue;
    }

    const phone = toUnisMsRecipient(candidate.contact_number);
    if (!phone) {
      await input.enqueue({
        appointmentId: candidate.appointment_id,
        messageType: "APPOINTMENT_REMINDER",
        content,
        recipientPhone: candidate.contact_number?.trim() || "invalid",
        status: "FAILED",
        failureClass: "validation",
        errorDetail: "Client mobile number is missing or invalid.",
      });
      summary.failed += 1;
      continue;
    }

    await input.enqueue({
      appointmentId: candidate.appointment_id,
      messageType: "APPOINTMENT_REMINDER",
      content,
      recipientPhone: phone,
      status: "PENDING",
      failureClass: "none",
      errorDetail: null,
    });
    summary.prepared += 1;
  }

  if (!input.providerConfigured || !clinicName || templateError) return summary;

  const dueIds = await input.listDueIds();
  for (const id of dueIds) {
    const claimed = await input.claim(id);
    if (!claimed) {
      summary.skipped += 1;
      continue;
    }
    if (claimed.referenceId) {
      summary.skipped += 1;
      continue;
    }
    const current = await input.assertCurrent(claimed.id);
    if (!current) {
      summary.skipped += 1;
      continue;
    }
    const result = await deliverClaimedMessage({
      message: claimed,
      now: input.now,
      delay: input.delay,
      send: () => input.send(claimed),
    });
    await input.record(claimed.id, result);
    if (result.internal_status === "SENT") summary.reportedSent += 1;
    else if (result.internal_status === "QUEUED") summary.accepted += 1;
    else if (result.failure_class === "config") summary.configBlocked += 1;
    else summary.failed += 1;
  }

  return summary;
}
