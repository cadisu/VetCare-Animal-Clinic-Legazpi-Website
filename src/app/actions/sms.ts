"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { FormState } from "@/app/actions/auth";
import { requireRole } from "@/lib/auth/session";
import { reminderTemplateError } from "@/lib/sms/template";
import type { ClaimedSms } from "@/lib/sms/deliver";
import { deliverClaimedSms, sendAppointmentReminderNow } from "@/lib/sms/job";
import { isSafeRedirectPath } from "@/lib/auth/roles";
import { isUuid } from "@/lib/pets/constants";
import { createClient } from "@/lib/supabase/server";

function withQuery(path: string, key: string, value: string): string {
  const [pathname, search] = path.split("?");
  const params = new URLSearchParams(search ?? "");
  params.set(key, value);
  return `${pathname}?${params.toString()}`;
}

function rpcMessage(error: { message?: string } | null): string {
  const msg = error?.message ?? "";
  if (msg.includes("uncertain")) return "This message may already have been sent, and its result cannot be confirmed. It was not sent again.";
  if (msg.includes("cannot be retried")) return "This message cannot be retried.";
  if (msg.includes("Invalid reminder")) return "The reminder message is missing a required placeholder or is too long.";
  if (msg.includes("Not authorized")) return "You are not allowed to perform this action.";
  return "Something went wrong. Please try again.";
}

export async function retrySmsAction(formData: FormData): Promise<void> {
  await requireRole(["STAFF", "SENIOR_VET"]);
  const smsId = String(formData.get("smsId") ?? "");
  const appointmentId = String(formData.get("appointmentId") ?? "");
  const requested = String(formData.get("returnTo") ?? "");
  const back =
    isSafeRedirectPath(requested) && (requested.startsWith("/staff/") || requested.startsWith("/senior-vet/"))
      ? requested
      : isUuid(appointmentId)
        ? `/staff/appointments/${appointmentId}`
        : "/staff/appointments/messages";
  if (!isUuid(smsId)) redirect(`${back}?flashError=${encodeURIComponent("This message cannot be retried.")}`);

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("claim_sms_manual_retry", { p_sms_id: smsId });
  if (error || !data || typeof data !== "object") {
    redirect(`${back}?flashError=${encodeURIComponent(rpcMessage(error))}`);
  }

  const row = data as Record<string, unknown>;
  const claimed: ClaimedSms = {
    id: String(row.id),
    appointmentId: String(row.appointment_id),
    content: String(row.content ?? ""),
    recipientPhone: String(row.recipient_phone ?? ""),
    messageType: String(row.message_type ?? ""),
    scheduleVersion: Number(row.schedule_version ?? 0),
    retryCount: Number(row.retry_count ?? 0),
    referenceId: typeof row.reference_id === "string" ? row.reference_id : null,
  };

  try {
    await deliverClaimedSms(claimed);
  } catch (sendError) {
    console.error("Manual SMS retry failed", sendError instanceof Error ? sendError.name : "Error");
  }

  revalidatePath("/staff/appointments/messages");
  revalidatePath("/senior-vet/appointments/messages");
  if (isUuid(appointmentId)) {
    revalidatePath(`/staff/appointments/${appointmentId}`);
    revalidatePath(`/senior-vet/appointments/${appointmentId}`);
  }
  redirect(`${back}?flash=retried`);
}

export async function sendAppointmentReminderNowAction(formData: FormData): Promise<void> {
  await requireRole(["STAFF", "SENIOR_VET"]);
  const appointmentId = String(formData.get("appointmentId") ?? "");
  const requested = String(formData.get("returnTo") ?? "");
  const back =
    isSafeRedirectPath(requested) &&
    (requested.startsWith("/staff/") || requested.startsWith("/senior-vet/"))
      ? requested
      : isUuid(appointmentId)
        ? `/staff/appointments/${appointmentId}`
        : "/staff/appointments";
  if (!isUuid(appointmentId)) {
    redirect(`${back}?flashError=${encodeURIComponent("Appointment not found.")}`);
  }

  const supabase = await createClient();
  const result = await sendAppointmentReminderNow(appointmentId, async (smsId) => {
    const { data, error } = await supabase.rpc("claim_sms_manual_retry", { p_sms_id: smsId });
    if (error || !data || typeof data !== "object") return null;
    const row = data as Record<string, unknown>;
    return {
      id: String(row.id),
      appointmentId: String(row.appointment_id),
      content: String(row.content ?? ""),
      recipientPhone: String(row.recipient_phone ?? ""),
      messageType: String(row.message_type ?? ""),
      scheduleVersion: Number(row.schedule_version ?? 0),
      retryCount: Number(row.retry_count ?? 0),
      referenceId: typeof row.reference_id === "string" ? row.reference_id : null,
    };
  });

  revalidatePath("/staff", "layout");
  revalidatePath("/senior-vet", "layout");
  revalidatePath("/staff/appointments/messages");
  revalidatePath("/senior-vet/appointments/messages");
  if (isUuid(appointmentId)) {
    revalidatePath(`/staff/appointments/${appointmentId}`);
    revalidatePath(`/senior-vet/appointments/${appointmentId}`);
  }
  if (!result.ok) redirect(withQuery(back, "flashError", result.error));
  redirect(withQuery(back, "flash", "reminder_sent"));
}

export async function updateSmsTemplateAction(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireRole(["STAFF", "SENIOR_VET"]);
  const kind = String(formData.get("kind") ?? "");
  const body = String(formData.get("body") ?? "");
  const values = { body, kind };
  const templateError = reminderTemplateError(body);
  if (templateError) return { error: templateError, values };
  if (kind !== "reminder" && kind !== "reschedule") return { error: "Choose a message to save.", values };

  const supabase = await createClient();
  const rpc = kind === "reschedule" ? "update_sms_reschedule_template" : "update_sms_reminder_template";
  const { error } = await supabase.rpc(rpc, { p_body: body });
  if (error) return { error: rpcMessage(error), values };

  revalidatePath("/staff/sms-templates");
  revalidatePath("/senior-vet/reminders");
  redirect(`/staff/sms-templates?flash=${kind}`);
}

export async function updateReminderTemplateAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const next = new FormData();
  next.set("kind", "reminder");
  next.set("body", String(formData.get("body") ?? ""));
  return updateSmsTemplateAction(_prev, next);
}
