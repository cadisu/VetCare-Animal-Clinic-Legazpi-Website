"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { FormState } from "@/app/actions/auth";
import { requireRole } from "@/lib/auth/session";
import { isUuid } from "@/lib/pets/constants";
import { serviceSchema } from "@/lib/validation/service";
import { createClient } from "@/lib/supabase/server";

const GENERIC = "Something went wrong. Please try again.";

function readService(formData: FormData) {
  return {
    name: String(formData.get("name") ?? ""),
    description: String(formData.get("description") ?? ""),
    category: String(formData.get("category") ?? "OTHER"),
    requiresVeterinarian: String(formData.get("requiresVeterinarian") ?? "true"),
    isActive: String(formData.get("isActive") ?? "true"),
    isBookable: String(formData.get("isBookable") ?? "true"),
    price: String(formData.get("price") ?? ""),
    durationMinutes: String(formData.get("durationMinutes") ?? ""),
    sortOrder: String(formData.get("sortOrder") ?? "0"),
  };
}

export async function upsertServiceFormAction(formData: FormData): Promise<void> {
  await upsertServiceAction({}, formData);
}

export async function upsertServiceAction(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireRole(["SENIOR_VET"]);
  const serviceId = String(formData.get("serviceId") ?? "").trim();
  const values = readService(formData);
  const parsed = serviceSchema.safeParse(values);
  if (!parsed.success) {
    return { fieldErrors: z.flattenError(parsed.error).fieldErrors, values };
  }

  const row = {
    name: parsed.data.name,
    description: parsed.data.description || null,
    category: parsed.data.category,
    requires_veterinarian: parsed.data.requiresVeterinarian,
    is_active: parsed.data.isActive,
    is_bookable: parsed.data.isBookable,
    price: parsed.data.price ? parsed.data.price : null,
    duration_minutes: parsed.data.durationMinutes ? Number(parsed.data.durationMinutes) : null,
    sort_order: parsed.data.sortOrder,
  };

  const supabase = await createClient();
  if (serviceId && isUuid(serviceId)) {
    const { error } = await supabase.from("services").update(row).eq("id", serviceId);
    if (error) return { error: GENERIC, values };
  } else {
    const { error } = await supabase.from("services").insert(row);
    if (error) return { error: GENERIC, values };
  }

  revalidatePath("/senior-vet/services");
  redirect("/senior-vet/services");
}
