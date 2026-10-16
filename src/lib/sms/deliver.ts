import type { SmsSendOutcome } from "@/lib/sms/provider";

export type ClaimedSms = {
  id: string;
  appointmentId: string;
  content: string;
  recipientPhone: string;
  messageType: string;
  scheduleVersion: number;
  retryCount: number;
  referenceId: string | null;
};

export type SmsRecordPayload = {
  internal_status: "QUEUED" | "SENT" | "FAILED";
  provider_status: string | null;
  reference_id: string | null;
  fail_reason: string | null;
  provider_response: unknown;
  failure_class: "none" | "config" | "validation" | "transient" | "uncertain";
  error_detail: string | null;
  outcome_uncertain: boolean;
  retry_count: number;
  next_retry_at: string | null;
};

const MAX_AUTO_RETRIES = 3;
const MAX_IN_REQUEST_WAIT_MS = 2000;

export function backoffMs(completedRetries: number): number {
  return Math.min(MAX_IN_REQUEST_WAIT_MS, 500 * 2 ** Math.max(0, completedRetries));
}

function payloadFromOutcome(outcome: SmsSendOutcome, retryCount: number, now: Date): SmsRecordPayload {
  if (outcome.kind === "accepted") {
    if (outcome.providerStatus === "sent") {
      return {
        internal_status: "SENT",
        provider_status: "sent",
        reference_id: outcome.referenceId,
        fail_reason: null,
        provider_response: outcome.response ?? null,
        failure_class: "none",
        error_detail: null,
        outcome_uncertain: false,
        retry_count: retryCount,
        next_retry_at: null,
      };
    }
    if (outcome.providerStatus === "failed") {
      return {
        internal_status: "FAILED",
        provider_status: "failed",
        reference_id: outcome.referenceId,
        fail_reason: outcome.failReason,
        provider_response: outcome.response ?? null,
        failure_class: "transient",
        error_detail: outcome.failReason,
        outcome_uncertain: false,
        retry_count: retryCount,
        next_retry_at: null,
      };
    }
    return {
      internal_status: "QUEUED",
      provider_status: outcome.providerStatus,
      reference_id: outcome.referenceId,
      fail_reason: null,
      provider_response: outcome.response ?? null,
      failure_class: "none",
      error_detail: null,
      outcome_uncertain: false,
      retry_count: retryCount,
      next_retry_at: null,
    };
  }

  if (outcome.kind === "config") {
    return {
      internal_status: "FAILED",
      provider_status: null,
      reference_id: null,
      fail_reason: null,
      provider_response: outcome.response ?? null,
      failure_class: "config",
      error_detail: outcome.error,
      outcome_uncertain: false,
      retry_count: retryCount,
      next_retry_at: null,
    };
  }

  if (outcome.kind === "validation") {
    return {
      internal_status: "FAILED",
      provider_status: null,
      reference_id: null,
      fail_reason: null,
      provider_response: outcome.response ?? null,
      failure_class: "validation",
      error_detail: outcome.error,
      outcome_uncertain: false,
      retry_count: retryCount,
      next_retry_at: null,
    };
  }

  if (outcome.kind === "uncertain") {
    return {
      internal_status: "FAILED",
      provider_status: null,
      reference_id: null,
      fail_reason: null,
      provider_response: null,
      failure_class: "uncertain",
      error_detail: outcome.error,
      outcome_uncertain: true,
      retry_count: retryCount,
      next_retry_at: null,
    };
  }

  const wait = outcome.retryAfterMs ?? backoffMs(retryCount);
  return {
    internal_status: "FAILED",
    provider_status: null,
    reference_id: null,
    fail_reason: null,
    provider_response: outcome.response ?? null,
    failure_class: "transient",
    error_detail: outcome.error,
    outcome_uncertain: false,
    retry_count: retryCount,
    next_retry_at: new Date(now.getTime() + wait).toISOString(),
  };
}

/**
 * One initial send plus up to three automatic retries.
 * Provider pending/retrying/sent stops the loop. Config failures do not advance retry_count.
 */
export async function deliverClaimedMessage(input: {
  message: ClaimedSms;
  send: () => Promise<SmsSendOutcome>;
  now: Date;
  delay?: (ms: number) => Promise<void>;
}): Promise<SmsRecordPayload> {
  const delay = input.delay ?? ((ms: number) => new Promise((resolve) => setTimeout(resolve, ms)));
  let retries = input.message.retryCount;
  let outcome: SmsSendOutcome;

  for (;;) {
    outcome = await input.send();
    if (outcome.kind !== "transient") break;
    if (retries >= MAX_AUTO_RETRIES) break;
    const wait = outcome.retryAfterMs ?? backoffMs(retries);
    if (wait > MAX_IN_REQUEST_WAIT_MS) break;
    retries += 1;
    await delay(wait);
  }

  const recordedRetries = outcome.kind === "config" ? input.message.retryCount : retries;
  return payloadFromOutcome(outcome, recordedRetries, input.now);
}
