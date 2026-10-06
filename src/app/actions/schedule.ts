"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { FormState } from "@/app/actions/auth";
import { requireRole } from "@/lib/auth/session";
import {
  blockDateSchema,
  publishSlotsSchema,
  slotBlockSchema,
  slotCapacitySchema,
} from "@/lib/validation/schedule";
import { createClient } from "@/lib/supabase/server";

const GENERIC = "Something went wrong. Please try again.";

export async function blockDateFormAction(formData: FormData): Promise<void> {
  await blockDateAction({}, formData);
}

export async function blockDateAction(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireRole(["STAFF", "SENIOR_VET"]);
  const raw = {
    blockDate: String(formData.get("blockDate") ?? ""),
    veterinarianId: String(formData.get("veterinarianId") ?? ""),
    reason: String(formData.get("reason") ?? ""),
  };
  const parsed = blockDateSchema.safeParse(raw);
  if (!parsed.success) return { fieldErrors: z.flattenError(parsed.error).fieldErrors, values: raw };

  const supabase = await createClient();
  const profile = await requireRole(["STAFF", "SENIOR_VET"]);
  const { error } = await supabase.from("blocked_dates").insert({
    block_date: parsed.data.blockDate,
    veterinarian_id: parsed.data.veterinarianId || null,
    reason: parsed.data.reason || null,
    created_by: profile.id,
  });
  if (error) return { error: GENERIC, values: raw };

  revalidatePath("/senior-vet/schedule");
  revalidatePath("/staff/appointments/slots");
  redirect("/senior-vet/schedule");
}

export async function unblockDateAction(formData: FormData): Promise<void> {
  await requireRole(["STAFF", "SENIOR_VET"]);
  const id = String(formData.get("id") ?? "");
  const supabase = await createClient();
  await supabase.from("blocked_dates").delete().eq("id", id);
  revalidatePath("/senior-vet/schedule");
  revalidatePath("/staff/appointments/slots");
}

export async function setSlotBlockedFormAction(formData: FormData): Promise<void> {
  await setSlotBlockedAction({}, formData);
}

export async function setSlotBlockedAction(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireRole(["STAFF", "SENIOR_VET"]);
  const parsed = slotBlockSchema.safeParse({
    slotId: String(formData.get("slotId") ?? ""),
    isBlocked: String(formData.get("isBlocked") ?? "true"),
  });
  if (!parsed.success) return { fieldErrors: z.flattenError(parsed.error).fieldErrors };

  const supabase = await createClient();
  const { error } = await supabase
    .from("appointment_slots")
    .update({ is_blocked: parsed.data.isBlocked })
    .eq("id", parsed.data.slotId);
  if (error) return { error: GENERIC };

  revalidatePath("/staff/appointments/slots");
  redirect(`/staff/appointments/slots?day=${formData.get("day") ?? ""}`);
}

export async function setSlotCapacityFormAction(formData: FormData): Promise<void> {
  await setSlotCapacityAction({}, formData);
}

export async function setSlotCapacityAction(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireRole(["SENIOR_VET"]);
  const parsed = slotCapacitySchema.safeParse({
    slotId: String(formData.get("slotId") ?? ""),
    capacity: String(formData.get("capacity") ?? ""),
  });
  if (!parsed.success) return { fieldErrors: z.flattenError(parsed.error).fieldErrors };

  const supabase = await createClient();
  const { error } = await supabase
    .from("appointment_slots")
    .update({ capacity: parsed.data.capacity })
    .eq("id", parsed.data.slotId);
  if (error?.message.includes("below current bookings")) {
    return { error: "Capacity cannot be below current bookings." };
  }
  if (error) return { error: GENERIC };

  revalidatePath("/staff/appointments/slots");
  redirect(`/staff/appointments/slots?day=${formData.get("day") ?? ""}`);
}

export async function publishSlotsFormAction(formData: FormData): Promise<void> {
  await publishSlotsAction({}, formData);
}

export async function publishSlotsAction(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireRole(["SENIOR_VET"]);
  const parsed = publishSlotsSchema.safeParse({
    fromDate: String(formData.get("fromDate") ?? ""),
    toDate: String(formData.get("toDate") ?? ""),
  });
  if (!parsed.success) return { fieldErrors: z.flattenError(parsed.error).fieldErrors };

  const supabase = await createClient();
  const { error } = await supabase.rpc("ensure_slots", {
    p_from: parsed.data.fromDate,
    p_to: parsed.data.toDate,
  });
  if (error) return { error: error.message || GENERIC };

  revalidatePath("/senior-vet/schedule");
  revalidatePath("/staff/appointments/slots");
  redirect("/senior-vet/schedule");
}
