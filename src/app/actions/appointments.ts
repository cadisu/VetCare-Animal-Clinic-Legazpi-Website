"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { FormState } from "@/app/actions/auth";
import type { AvailabilityRow } from "@/lib/appointments/constants";
import { fetchAvailability } from "@/lib/appointments/server";
import { requireRole } from "@/lib/auth/session";
import { isUuid } from "@/lib/pets/constants";
import { bookAppointmentSchema, staffAppointmentSchema } from "@/lib/validation/appointment";
import { createClient } from "@/lib/supabase/server";

const GENERIC = "Something went wrong. Please try again.";

function rpcMessage(error: { message?: string } | null): string {
  const msg = error?.message ?? "";
  if (msg.includes("already has an appointment") || msg.includes("appointments_pet_slot_active_idx")) {
    return "This pet already has an appointment at that date and time.";
  }
  if (msg.includes("full")) return "This time slot is already full. Please choose another.";
  if (msg.includes("past")) return "That time has passed. Please choose a later slot.";
  if (msg.includes("Not authorized")) return "You are not allowed to perform this action.";
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
  redirect(`/client/appointments/${data}`);
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
  redirect(`/staff/appointments?day=${formData.get("day") ?? ""}`);
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

export async function markAppointmentCompletedAction(formData: FormData): Promise<void> {
  await requireRole(["STAFF", "SENIOR_VET"]);
  const appointmentId = String(formData.get("appointmentId") ?? "").trim();
  const returnDay = String(formData.get("day") ?? "").trim();
  if (!appointmentId) return;

  const supabase = await createClient();
  const { error } = await supabase.rpc("mark_appointment_completed", {
    p_appointment_id: appointmentId,
  });

  revalidatePath("/staff");
  revalidatePath("/staff/appointments");
  revalidatePath("/senior-vet");
  revalidatePath("/senior-vet/appointments");
  revalidatePath("/client");
  revalidatePath("/client/appointments");
  revalidatePath(`/client/appointments/${appointmentId}`);

  const requestedReturn = String(formData.get("returnTo") ?? "");
  const destination =
    requestedReturn === "/senior-vet/appointments" || requestedReturn === "/senior-vet/appointments/future"
      ? requestedReturn
      : "/staff/appointments";

  const params = new URLSearchParams();
  if (returnDay && destination !== "/senior-vet/appointments/future") params.set("day", returnDay);
  if (error) params.set("completeError", error.message);
  else params.set("completed", "1");
  const qs = params.toString() ? `?${params.toString()}` : "";
  redirect(`${destination}${qs}`);
}
