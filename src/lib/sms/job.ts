import "server-only";
import { clinic } from "@/config/clinic";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ClaimedSms, SmsRecordPayload } from "@/lib/sms/deliver";
import { deliverClaimedMessage } from "@/lib/sms/deliver";
import { dispatchReminders, type DispatchSummary, type EnqueueSmsInput, type ReminderCandidate } from "@/lib/sms/dispatch";
import { eventForProviderStatus } from "@/lib/sms/provider";
import { nextManilaDateIso } from "@/lib/sms/schedule";
import { createUnisMsClient, unisMsConfigured } from "@/lib/sms/unisms";

type AdminClient = NonNullable<ReturnType<typeof createAdminClient>>;

function asClaimed(data: unknown): ClaimedSms | null {
  if (!data || typeof data !== "object") return null;
  const row = data as Record<string, unknown>;
  if (row.cancelled === true || row.skipped === true || typeof row.id !== "string") return null;
  return {
    id: row.id,
    appointmentId: String(row.appointment_id),
    content: String(row.content ?? ""),
    recipientPhone: String(row.recipient_phone ?? ""),
    messageType: String(row.message_type ?? ""),
    scheduleVersion: Number(row.schedule_version ?? 0),
    retryCount: Number(row.retry_count ?? 0),
    referenceId: typeof row.reference_id === "string" ? row.reference_id : null,
  };
}

async function recordResult(admin: AdminClient, id: string, result: SmsRecordPayload) {
  const { error } = await admin.rpc("record_sms_provider_result", {
    p_sms_id: id,
    p_result: result,
  });
  if (error) throw error;
}

async function reconcileQueued(admin: AdminClient) {
  const configured = unisMsConfigured();
  if (!configured) return;
  const client = createUnisMsClient(configured);
  const { data, error } = await admin.rpc("list_sms_to_reconcile");
  if (error) throw error;
  const rows = Array.isArray(data) ? data : [];
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const referenceId = (row as { reference_id?: unknown }).reference_id;
    const id = (row as { id?: unknown }).id;
    if (typeof referenceId !== "string" || typeof id !== "string") continue;
    const got = await client.getSms(referenceId);
    if (got.kind === "not_found") {
      await recordResult(admin, id, {
        internal_status: "FAILED",
        provider_status: null,
        reference_id: referenceId,
        fail_reason: null,
        provider_response: null,
        failure_class: "uncertain",
        error_detail: "UniSMS has no message for this reference. It was not sent again.",
        outcome_uncertain: true,
        retry_count: 0,
        next_retry_at: null,
      });
      continue;
    }
    if (got.kind !== "status") continue;
    const event = eventForProviderStatus(got.message.status);
    if (!event) continue;
    const { error: applyError } = await admin.rpc("apply_sms_provider_event", {
      p_reference_id: got.message.referenceId,
      p_event: event,
      p_provider_status: got.message.status,
      p_fail_reason: got.message.failReason,
      p_webhook_id: null,
      p_payload: got.response ?? null,
    });
    if (applyError) throw applyError;
  }
}

export async function deliverClaimedSms(claimed: ClaimedSms): Promise<void> {
  const admin = createAdminClient();
  if (!admin) return;
  const configured = unisMsConfigured();
  if (!configured) {
    await recordResult(admin, claimed.id, {
      internal_status: "FAILED",
      provider_status: null,
      reference_id: claimed.referenceId,
      fail_reason: null,
      provider_response: null,
      failure_class: "config",
      error_detail: "SMS provider is not configured.",
      outcome_uncertain: false,
      retry_count: claimed.retryCount,
      next_retry_at: null,
    });
    return;
  }

  const client = createUnisMsClient(configured);
  let message = claimed;

  if (message.referenceId) {
    const got = await client.getSms(message.referenceId);
    if (got.kind === "not_found") {
      await recordResult(admin, message.id, {
        internal_status: "FAILED",
        provider_status: null,
        reference_id: message.referenceId,
        fail_reason: null,
        provider_response: null,
        failure_class: "uncertain",
        error_detail: "UniSMS has no message for this reference. It was not sent again.",
        outcome_uncertain: true,
        retry_count: message.retryCount,
        next_retry_at: null,
      });
      return;
    }
    if (got.kind === "config") {
      await recordResult(admin, message.id, {
        internal_status: "FAILED",
        provider_status: null,
        reference_id: message.referenceId,
        fail_reason: null,
        provider_response: null,
        failure_class: "config",
        error_detail: got.error,
        outcome_uncertain: false,
        retry_count: message.retryCount,
        next_retry_at: null,
      });
      return;
    }
    if (got.kind === "status") {
      const event = eventForProviderStatus(got.message.status);
      if (event && got.message.status !== "failed") {
        await admin.rpc("apply_sms_provider_event", {
          p_reference_id: got.message.referenceId,
          p_event: event,
          p_provider_status: got.message.status,
          p_fail_reason: got.message.failReason,
          p_webhook_id: null,
          p_payload: got.response ?? null,
        });
        return;
      }
      if (!event) {
        await recordResult(admin, message.id, {
          internal_status: "QUEUED",
          provider_status: "pending",
          reference_id: message.referenceId,
          fail_reason: null,
          provider_response: got.response ?? null,
          failure_class: "none",
          error_detail: null,
          outcome_uncertain: false,
          retry_count: message.retryCount,
          next_retry_at: null,
        });
        return;
      }
      const { data: cleared, error } = await admin.rpc("clear_failed_sms_reference", { p_sms_id: message.id });
      if (error || cleared !== true) return;
      message = { ...message, referenceId: null };
    } else {
      return;
    }
  }

  const { data: current, error: currentError } = await admin.rpc("assert_sms_current", { p_sms_id: message.id });
  if (currentError || current !== true) return;

  const result = await deliverClaimedMessage({
    message,
    now: new Date(),
    send: () =>
      client.sendSms({
        recipient: message.recipientPhone,
        content: message.content,
        metadata: {
          appointment_id: message.appointmentId,
          sms_message_id: message.id,
          template: message.messageType,
        },
      }),
  });
  await recordResult(admin, message.id, result);
}

export async function sendPendingSms(smsId: string): Promise<void> {
  const admin = createAdminClient();
  if (!admin) return;
  const target = nextManilaDateIso(new Date());
  const { data, error } = await admin.rpc("claim_sms_for_delivery", {
    p_sms_id: smsId,
    p_target_date: target,
  });
  if (error) return;
  const claimed = asClaimed(data);
  if (!claimed) return;
  await deliverClaimedSms(claimed);
}

export async function runAppointmentReminderJob(now = new Date()): Promise<DispatchSummary> {
  const admin = createAdminClient();
  if (!admin) {
    return { prepared: 0, configBlocked: 0, accepted: 0, reportedSent: 0, failed: 0, skipped: 0 };
  }

  await reconcileQueued(admin);

  const target = nextManilaDateIso(now);
  const configured = unisMsConfigured();
  const [{ data: template }, { data: candidates, error: candidateError }] = await Promise.all([
    admin.rpc("get_sms_reminder_template"),
    admin.rpc("list_reminder_candidates", { p_target_date: target }),
  ]);
  if (candidateError) throw candidateError;

  const client = configured ? createUnisMsClient(configured) : null;

  return dispatchReminders({
    now,
    clinicName: clinic.name,
    template: typeof template === "string" ? template : null,
    providerConfigured: Boolean(configured),
    candidates: (Array.isArray(candidates) ? candidates : []) as ReminderCandidate[],
    enqueue: async (row: EnqueueSmsInput) => {
      const { error } = await admin.rpc("enqueue_sms_message", {
        p_appointment_id: row.appointmentId,
        p_message_type: row.messageType,
        p_content: row.content,
        p_recipient_phone: row.recipientPhone,
        p_status: row.status,
        p_failure_class: row.failureClass,
        p_error_detail: row.errorDetail,
      });
      if (error) throw error;
    },
    listDueIds: async () => {
      const { data, error } = await admin.rpc("list_due_sms_ids", { p_target_date: target });
      if (error) throw error;
      return Array.isArray(data) ? data.filter((id): id is string => typeof id === "string") : [];
    },
    claim: async (id: string) => {
      const { data, error } = await admin.rpc("claim_sms_for_delivery", {
        p_sms_id: id,
        p_target_date: target,
      });
      if (error) throw error;
      return asClaimed(data);
    },
    assertCurrent: async (id: string) => {
      const { data, error } = await admin.rpc("assert_sms_current", { p_sms_id: id });
      if (error) throw error;
      return data === true;
    },
    send: (message) => {
      if (!client) return Promise.resolve({ kind: "config" as const, error: "SMS provider is not configured." });
      return client.sendSms({
        recipient: message.recipientPhone,
        content: message.content,
        metadata: {
          appointment_id: message.appointmentId,
          sms_message_id: message.id,
          template: message.messageType,
        },
      });
    },
    record: (id, result) => recordResult(admin, id, result),
  });
}
