"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { FormState } from "@/app/actions/auth";
import type { AppointmentStatus, AvailabilityRow } from "@/lib/appointments/constants";
import { fetchAvailability } from "@/lib/appointments/server";
import { listBilledServiceIds } from "@/lib/pos/server";
import {
  appointmentNoticeCode,
  appointmentTransitionErrorCode,
} from "@/lib/appointments/transitions";
import type { UserRole } from "@/lib/auth/roles";
import { requireRole } from "@/lib/auth/session";
import { todayIso } from "@/lib/dates";
import { isUuid } from "@/lib/pets/constants";
import {
  appointmentTransitionSchema,
  bookAppointmentSchema,
  staffAppointmentSchema,
} from "@/lib/validation/appointment";
import { parseConsultationWeight } from "@/lib/validation/clinical";
import { createClient } from "@/lib/supabase/server";

const GENERIC = "Something went wrong. Please try again.";

function rpcMessage(error: { message?: string } | null): string {
  const msg = error?.message ?? "";
  if (msg.includes("already has an appointment") || msg.includes("appointments_pet_slot_active_idx")) {
    return "This pet already has an appointment at that date and time.";
  }
  if (msg.includes("full")) return "This time slot is already full. Please choose another.";
  if (msg.includes("past date")) return "Walk-ins can only be recorded for today. Choose a time from today.";
  if (msg.includes("past") || msg.includes("already ended")) return "That time has passed. Please choose a later slot.";
  if (msg.includes("Not authorized")) return "You are not allowed to perform this action.";
  if (msg.includes("requires a veterinarian slot")) {
    return "This service needs a veterinarian time. Choose the veterinarian, then pick a time.";
  }
  if (msg.includes("clinic-wide slots")) {
    return "This service uses a clinic time. Choose the time again.";
  }
  if (msg.includes("Invalid")) return msg;
  return GENERIC;
}

export async function bookAppointmentAction(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireRole(["CLIENT"]);
  const raw = {
    petId: String(formData.get("petId") ?? ""),
    serviceId: String(formData.get("serviceId") ?? ""),
    slotId: String(formData.get("slotId") ?? ""),
    veterinarianId: String(formData.get("veterinarianId") ?? ""),
  };
  const parsed = bookAppointmentSchema.safeParse(raw);
  if (!parsed.success) {
    return { fieldErrors: z.flattenError(parsed.error).fieldErrors, values: raw };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("book_appointment", {
    p_pet_id: parsed.data.petId,
    p_service_id: parsed.data.serviceId,
    p_slot_id: parsed.data.slotId,
  });

  if (error || !data) return { error: rpcMessage(error) };

  revalidatePath("/client");
  revalidatePath("/client/appointments");
  revalidatePath(`/client/appointments/${data}`);
  revalidatePath(`/client/appointments/${data}/confirmed`);
  redirect(`/client/appointments/${data}/confirmed`);
}

export async function createStaffAppointmentAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireRole(["STAFF", "SENIOR_VET"]);
  const raw = {
    clientId: String(formData.get("clientId") ?? ""),
    petId: String(formData.get("petId") ?? ""),
    serviceId: String(formData.get("serviceId") ?? ""),
    slotId: String(formData.get("slotId") ?? ""),
    source: String(formData.get("source") ?? "WALK_IN"),
    allowOverCapacity: formData.get("allowOverCapacity") === "on",
  };
  const parsed = staffAppointmentSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      fieldErrors: z.flattenError(parsed.error).fieldErrors,
      values: {
        clientId: raw.clientId,
        petId: raw.petId,
        serviceId: raw.serviceId,
        slotId: raw.slotId,
        source: raw.source,
        allowOverCapacity: raw.allowOverCapacity ? "on" : "",
      },
    };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_staff_appointment", {
    p_client_id: parsed.data.clientId,
    p_pet_id: parsed.data.petId,
    p_service_id: parsed.data.serviceId,
    p_slot_id: parsed.data.slotId,
    p_source: parsed.data.source,
    p_allow_over_capacity: parsed.data.allowOverCapacity ?? false,
  });

  if (error || !data) return { error: rpcMessage(error) };

  revalidatePath("/staff");
  revalidatePath("/staff/appointments");
  const day = String(formData.get("day") ?? "").trim();
  const dayParam = /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : "";
  const qs = new URLSearchParams();
  if (dayParam) qs.set("day", dayParam);
  qs.set("created", String(data));
  redirect(`/staff/appointments?${qs.toString()}`);
}

export async function fetchBookingAvailabilityAction(
  serviceId: string,
  veterinarianId: string | null,
  petId: string,
): Promise<{ availability: AvailabilityRow[] } | { error: string }> {
  const profile = await requireRole(["CLIENT"]);
  if (!isUuid(serviceId)) return { error: "Invalid service." };
  if (!isUuid(petId)) return { error: "Select a pet." };

  const supabase = await createClient();
  const { data: service } = await supabase
    .from("services")
    .select("id, requires_veterinarian, is_active, is_bookable")
    .eq("id", serviceId)
    .maybeSingle();

  if (!service?.is_active || !service.is_bookable) {
    return { error: "Service is not available for booking." };
  }

  const { data: pet } = await supabase
    .from("pets")
    .select("id")
    .eq("id", petId)
    .eq("owner_id", profile.id)
    .eq("is_archived", false)
    .maybeSingle();
  if (!pet) return { error: "Select a pet." };

  let vetId: string | null = veterinarianId;
  if (service.requires_veterinarian) {
    if (!vetId || !isUuid(vetId)) return { error: "Select a veterinarian." };
  } else {
    vetId = null;
  }

  try {
    const availability = await fetchAvailability(supabase, serviceId, vetId, undefined, undefined, petId);
    return { availability };
  } catch {
    return { error: GENERIC };
  }
}

export async function fetchStaffBookingAvailabilityAction(
  clientId: string,
  serviceId: string,
  veterinarianId: string | null,
  petId: string,
): Promise<{ availability: AvailabilityRow[] } | { error: string }> {
  await requireRole(["STAFF", "SENIOR_VET"]);
  if (!isUuid(clientId)) return { error: "Select a client." };
  if (!isUuid(serviceId)) return { error: "Invalid service." };
  if (!isUuid(petId)) return { error: "Select a pet." };

  const supabase = await createClient();
  const { data: service } = await supabase
    .from("services")
    .select("id, requires_veterinarian, is_active, is_bookable")
    .eq("id", serviceId)
    .maybeSingle();

  if (!service?.is_active || !service.is_bookable) {
    return { error: "Service is not available for booking." };
  }

  const { data: pet } = await supabase
    .from("pets")
    .select("id")
    .eq("id", petId)
    .eq("owner_id", clientId)
    .eq("is_archived", false)
    .maybeSingle();
  if (!pet) return { error: "Select a pet." };

  let vetId: string | null = veterinarianId;
  if (service.requires_veterinarian) {
    if (!vetId || !isUuid(vetId)) return { error: "Select a veterinarian." };
  } else {
    vetId = null;
  }

  const today = todayIso();
  try {
    const availability = await fetchAvailability(supabase, serviceId, vetId, today, today, petId);
    return { availability };
  } catch {
    return { error: GENERIC };
  }
}

function transitionDestination(
  role: UserRole,
  appointmentId: string,
  requested: string,
): { path: string; keepDay: boolean } {
  if (role === "CLIENT") {
    return { path: `/client/appointments/${appointmentId}`, keepDay: false };
  }
  if (requested === "/senior-vet") {
    return { path: requested, keepDay: false };
  }
  if (requested === "/senior-vet/appointments" || requested === "/senior-vet/appointments/future") {
    return { path: requested, keepDay: requested !== "/senior-vet/appointments/future" };
  }
  if (/^\/senior-vet\/appointments\/[0-9a-f-]{36}$/i.test(requested)) {
    return { path: requested, keepDay: false };
  }
  if (/^\/staff\/appointments\/[0-9a-f-]{36}$/i.test(requested)) {
    return { path: requested, keepDay: false };
  }
  if (requested === "/staff" || requested === "/staff/appointments/upcoming") {
    return { path: requested, keepDay: false };
  }
  return { path: "/staff/appointments", keepDay: true };
}

function redirectWithAppointmentStatus(
  path: string,
  keepDay: boolean,
  day: string | undefined,
  notice: string | null,
  statusError: string | null,
): never {
  const params = new URLSearchParams();
  if (keepDay && day) params.set("day", day);
  if (notice) params.set("notice", notice);
  if (statusError) params.set("statusError", statusError);
  const qs = params.toString();
  redirect(qs ? `${path}?${qs}` : path);
}

async function finishedVisitBilling(
  supabase: Awaited<ReturnType<typeof createClient>>,
  appointmentId: string,
): Promise<{ kind: "bill"; id: string } | { kind: "already-billed" } | { kind: "missing-price" } | { kind: "continue" }> {
  const { data: openBill } = await supabase
    .from("pos_transactions")
    .select("id")
    .eq("appointment_id", appointmentId)
    .eq("status", "OPEN")
    .limit(1)
    .maybeSingle();
  if (openBill?.id) return { kind: "bill", id: openBill.id };

  const { data: appointment } = await supabase
    .from("appointments")
    .select("service_id")
    .eq("id", appointmentId)
    .maybeSingle();
  const serviceId = appointment?.service_id;
  if (!serviceId) return { kind: "continue" };

  const billed = await listBilledServiceIds(supabase, appointmentId);
  if (billed.includes(serviceId)) return { kind: "already-billed" };

  const { data: service } = await supabase
    .from("services")
    .select("price, is_active")
    .eq("id", serviceId)
    .maybeSingle();
  if (!service?.is_active || service.price == null) return { kind: "missing-price" };

  const { data, error } = await supabase.rpc("pos_open_for_appointment", {
    p_appointment_id: appointmentId,
  });
  if (error || typeof data !== "string") return { kind: "continue" };
  return { kind: "bill", id: data };
}

function revalidateAppointmentViews(appointmentId: string) {
  revalidatePath("/client", "layout");
  revalidatePath("/staff", "layout");
  revalidatePath("/senior-vet", "layout");
  revalidatePath(`/client/appointments/${appointmentId}`);
}

export async function transitionAppointmentStatusAction(formData: FormData): Promise<void> {
  const profile = await requireRole(["CLIENT", "STAFF", "SENIOR_VET"]);
  const dayRaw = String(formData.get("day") ?? "").trim();
  const reasonRaw = String(formData.get("reason") ?? "");
  const parsed = appointmentTransitionSchema.safeParse({
    appointmentId: String(formData.get("appointmentId") ?? "").trim(),
    nextStatus: String(formData.get("nextStatus") ?? "").trim(),
    reason: reasonRaw.trim() ? reasonRaw.trim() : undefined,
    day: /^\d{4}-\d{2}-\d{2}$/.test(dayRaw) ? dayRaw : undefined,
    returnTo: String(formData.get("returnTo") ?? ""),
  });

  if (!parsed.success) {
    const path =
      profile.role === "CLIENT"
        ? "/client/appointments"
        : profile.role === "SENIOR_VET"
          ? "/senior-vet/appointments"
          : "/staff/appointments";
    redirectWithAppointmentStatus(path, false, undefined, null, "generic");
  }

  const { appointmentId, nextStatus, reason, day, returnTo } = parsed.data;
  const destination = transitionDestination(profile.role, appointmentId, returnTo ?? "");
  const reasonForRpc =
    profile.role !== "CLIENT" && nextStatus === "CANCELLED" ? reason ?? null : null;

  const supabase = await createClient();
  if (profile.role !== "CLIENT" && nextStatus === "IN_CONSULTATION") {
    const weight = parseConsultationWeight(String(formData.get("weightKg") ?? ""));
    if (!weight.ok) {
      redirectWithAppointmentStatus(destination.path, destination.keepDay, day, null, "weight");
    }
    if (weight.kg !== null) {
      const { data: appointment } = await supabase
        .from("appointments")
        .select("pet_id")
        .eq("id", appointmentId)
        .maybeSingle();
      if (!appointment?.pet_id) {
        redirectWithAppointmentStatus(destination.path, destination.keepDay, day, null, "not_found");
      }
      const { error: weightError } = await supabase.rpc("record_pet_weight", {
        p_pet_id: appointment.pet_id,
        p_weight_kg: weight.kg,
        p_appointment_id: appointmentId,
      });
      if (weightError) {
        const message = weightError.message ?? "";
        redirectWithAppointmentStatus(
          destination.path,
          destination.keepDay,
          day,
          null,
          message.includes("weight") ? "weight" : appointmentTransitionErrorCode(message),
        );
      }
    }
  }

  const { error } = await supabase.rpc("transition_appointment_status", {
    p_appointment_id: appointmentId,
    p_next_status: nextStatus,
    p_reason: reasonForRpc,
  });

  revalidateAppointmentViews(appointmentId);

  if (error) {
    redirectWithAppointmentStatus(
      destination.path,
      destination.keepDay,
      day,
      null,
      appointmentTransitionErrorCode(error.message ?? ""),
    );
  }

  if (profile.role !== "CLIENT" && nextStatus === "COMPLETED") {
    const billing = await finishedVisitBilling(supabase, appointmentId);
    if (billing.kind === "bill") {
      revalidatePath("/staff/pos", "layout");
      redirect(`/staff/pos?bill=${billing.id}&notice=visit-finished`);
    }
    if (billing.kind === "already-billed") {
      redirectWithAppointmentStatus(destination.path, destination.keepDay, day, "already_billed", null);
    }
    if (billing.kind === "missing-price") {
      redirectWithAppointmentStatus(destination.path, destination.keepDay, day, "completed", "missing_price");
    }
  }

  redirectWithAppointmentStatus(
    destination.path,
    destination.keepDay,
    day,
    appointmentNoticeCode(nextStatus as AppointmentStatus),
    null,
  );
}

/** Preserved completion entry point. The RPC only completes IN_CONSULTATION appointments. */
export async function markAppointmentCompletedAction(formData: FormData): Promise<void> {
  formData.set("nextStatus", "COMPLETED");
  await transitionAppointmentStatusAction(formData);
}
