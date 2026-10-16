"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { clinic } from "@/config/clinic";
import type { FormState } from "@/app/actions/auth";
import type { AvailabilityRow } from "@/lib/appointments/constants";
import { fetchAvailability } from "@/lib/appointments/server";
import { requireRole } from "@/lib/auth/session";
import { sendPendingSms } from "@/lib/sms/job";
import { isUuid } from "@/lib/pets/constants";
import { createClient } from "@/lib/supabase/server";

const GENERIC = "Something went wrong. Please try again.";

function rpcMessage(error: { message?: string } | null): string {
  const msg = error?.message ?? "";
  if (msg.includes("already pending")) return "A reschedule request is already waiting for review.";
  if (msg.includes("already has an appointment")) return "This pet already has an appointment at that date and time.";
  if (msg.includes("full")) return "This time slot is already full. Please choose another.";
  if (msg.includes("passed") || msg.includes("past")) return "That time has passed. Please choose a later slot.";
  if (msg.includes("no longer pending")) return "This request is no longer pending.";
  if (msg.includes("cannot be rescheduled")) return "This appointment can no longer be rescheduled.";
  if (msg.includes("Not authorized")) return "You are not allowed to perform this action.";
  if (msg.includes("different time")) return "Choose a different time slot.";
  if (msg.includes("not available")) return "That time slot is not available.";
  return GENERIC;
}

function revalidateAppointment(appointmentId: string) {
  revalidatePath("/client", "layout");
  revalidatePath("/staff", "layout");
  revalidatePath("/senior-vet", "layout");
  revalidatePath(`/client/appointments/${appointmentId}`);
  revalidatePath(`/staff/appointments/${appointmentId}`);
  revalidatePath("/staff/appointments/requests");
}

async function notifyIfPending(result: unknown) {
  if (!result || typeof result !== "object") return;
  const row = result as { sms_message_id?: unknown; sms_status?: unknown };
  if (row.sms_status === "PENDING" && typeof row.sms_message_id === "string") {
    try {
      await sendPendingSms(row.sms_message_id);
    } catch (error) {
      console.error("Reschedule notification was not sent", error instanceof Error ? error.name : "Error");
    }
  }
}

export async function fetchRescheduleAvailabilityAction(
  appointmentId: string,
  veterinarianId: string | null,
): Promise<{ availability: AvailabilityRow[]; currentSlotId: string } | { error: string }> {
  const profile = await requireRole(["CLIENT", "STAFF", "SENIOR_VET"]);
  if (!isUuid(appointmentId)) return { error: "Appointment not found." };
  const supabase = await createClient();
  const { data: appointment } = await supabase
    .from("appointments")
    .select("id, client_id, pet_id, service_id, slot_id, status, service:services!appointments_service_id_fkey ( requires_veterinarian )")
    .eq("id", appointmentId)
    .maybeSingle();

  if (!appointment) return { error: "Appointment not found." };
  if (profile.role === "CLIENT" && appointment.client_id !== profile.id) {
    return { error: "You are not allowed to perform this action." };
  }
  if (appointment.status !== "PENDING" && appointment.status !== "CONFIRMED") {
    return { error: "This appointment can no longer be rescheduled." };
  }

  const service = appointment.service as { requires_veterinarian?: boolean } | { requires_veterinarian?: boolean }[] | null;
  const requiresVet = Array.isArray(service) ? service[0]?.requires_veterinarian : service?.requires_veterinarian;
  let vetId: string | null = veterinarianId;
  if (requiresVet) {
    if (!vetId || !isUuid(vetId)) return { error: "Select a veterinarian." };
  } else {
    vetId = null;
  }

  try {
    const availability = await fetchAvailability(
      supabase,
      appointment.service_id,
      vetId,
      undefined,
      undefined,
      appointment.pet_id,
    );
    return {
      availability: availability.filter((slot) => slot.slot_state === "AVAILABLE" && slot.slot_id !== appointment.slot_id),
      currentSlotId: appointment.slot_id,
    };
  } catch {
    return { error: GENERIC };
  }
}

export async function submitRescheduleRequestAction(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireRole(["CLIENT"]);
  const appointmentId = String(formData.get("appointmentId") ?? "");
  const slotId = String(formData.get("slotId") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();
  if (!isUuid(appointmentId) || !isUuid(slotId)) return { error: "Choose an available time." };
  if (reason.length > 500) return { error: "The reason must be 500 characters or fewer." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("submit_reschedule_request", {
    p_appointment_id: appointmentId,
    p_new_slot_id: slotId,
    p_reason: reason || null,
  });
  if (error) return { error: rpcMessage(error) };

  revalidateAppointment(appointmentId);
  redirect(`/client/appointments/${appointmentId}?flash=requested`);
}

export async function withdrawRescheduleRequestAction(formData: FormData): Promise<void> {
  await requireRole(["CLIENT"]);
  const appointmentId = String(formData.get("appointmentId") ?? "");
  const requestId = String(formData.get("requestId") ?? "");
  if (!isUuid(appointmentId) || !isUuid(requestId)) redirect("/client/appointments");
  const supabase = await createClient();
  await supabase.rpc("withdraw_reschedule_request", { p_request_id: requestId });
  revalidateAppointment(appointmentId);
  redirect(`/client/appointments/${appointmentId}?flash=withdrawn`);
}

export async function rescheduleAppointmentAction(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireRole(["STAFF", "SENIOR_VET"]);
  const appointmentId = String(formData.get("appointmentId") ?? "");
  const slotId = String(formData.get("slotId") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();
  if (!isUuid(appointmentId) || !isUuid(slotId)) return { error: "Choose an available time." };
  if (reason.length > 500) return { error: "The reason must be 500 characters or fewer." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("reschedule_appointment", {
    p_appointment_id: appointmentId,
    p_new_slot_id: slotId,
    p_reason: reason || null,
    p_clinic_name: clinic.name,
  });
  if (error) return { error: rpcMessage(error) };
  await notifyIfPending(data);
  revalidateAppointment(appointmentId);
  const requested = String(formData.get("returnTo") ?? "");
  const detailPath = appointmentDetailPath(requested, appointmentId);
  redirect(`${detailPath}?flash=rescheduled`);
}

function appointmentDetailPath(returnTo: string, appointmentId: string): string {
  if (isUuid(appointmentId) && returnTo === `/senior-vet/appointments/${appointmentId}`) {
    return returnTo;
  }
  return `/staff/appointments/${appointmentId}`;
}

function reviewTarget(returnTo: string, appointmentId: string, fallback: string): string {
  if (returnTo === "detail" && isUuid(appointmentId)) return `/staff/appointments/${appointmentId}`;
  if (returnTo === "/senior-vet/appointments/requests" || returnTo === "/staff/appointments/requests") {
    return returnTo;
  }
  if (isUuid(appointmentId) && (returnTo === `/senior-vet/appointments/${appointmentId}` || returnTo === `/staff/appointments/${appointmentId}`)) {
    return returnTo;
  }
  return fallback;
}

export async function approveRescheduleRequestAction(formData: FormData): Promise<void> {
  await requireRole(["STAFF", "SENIOR_VET"]);
  const appointmentId = String(formData.get("appointmentId") ?? "");
  const requestId = String(formData.get("requestId") ?? "");
  const returnTo = String(formData.get("returnTo") ?? "");
  if (!isUuid(requestId)) redirect(reviewTarget(returnTo, appointmentId, "/staff/appointments/requests"));

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("approve_reschedule_request", {
    p_request_id: requestId,
    p_clinic_name: clinic.name,
  });
  if (isUuid(appointmentId)) revalidateAppointment(appointmentId);
  revalidatePath("/staff/appointments/requests");
  revalidatePath("/senior-vet/appointments/requests");
  const target = reviewTarget(returnTo, appointmentId, "/staff/appointments/requests");
  if (error) redirect(`${target}?flashError=${encodeURIComponent(rpcMessage(error))}`);
  await notifyIfPending(data);
  redirect(`${target}?flash=approved`);
}

export async function rejectRescheduleRequestAction(formData: FormData): Promise<void> {
  await requireRole(["STAFF", "SENIOR_VET"]);
  const appointmentId = String(formData.get("appointmentId") ?? "");
  const requestId = String(formData.get("requestId") ?? "");
  const note = String(formData.get("reviewNote") ?? "").trim();
  const returnTo = String(formData.get("returnTo") ?? "");
  if (!isUuid(requestId)) redirect(reviewTarget(returnTo, appointmentId, "/staff/appointments/requests"));
  const supabase = await createClient();
  const { error } = await supabase.rpc("reject_reschedule_request", {
    p_request_id: requestId,
    p_review_note: note || null,
  });
  if (isUuid(appointmentId)) revalidateAppointment(appointmentId);
  revalidatePath("/staff/appointments/requests");
  revalidatePath("/senior-vet/appointments/requests");
  const target = reviewTarget(returnTo, appointmentId, "/staff/appointments/requests");
  if (error) redirect(`${target}?flashError=${encodeURIComponent(rpcMessage(error))}`);
  redirect(`${target}?flash=rejected`);
}
