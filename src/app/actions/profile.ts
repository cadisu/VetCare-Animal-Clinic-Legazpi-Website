"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { FormState } from "@/app/actions/auth";
import { requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { clientProfileSchema } from "@/lib/validation/client";

function text(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

/** Clients may edit only their basic personal information (never email, role or status). */
export async function updateClientProfileAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const profile = await requireRole(["CLIENT"]);
  const values = {
    lastName: text(formData, "lastName"),
    middleName: text(formData, "middleName"),
    firstName: text(formData, "firstName"),
    address: text(formData, "address"),
    birthdate: text(formData, "birthdate"),
    contactNumber: text(formData, "contactNumber"),
  };

  const parsed = clientProfileSchema.safeParse(values);
  if (!parsed.success) {
    return { fieldErrors: z.flattenError(parsed.error).fieldErrors, values };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .update({
      last_name: parsed.data.lastName,
      middle_name: parsed.data.middleName,
      first_name: parsed.data.firstName,
      address: parsed.data.address,
      birthdate: parsed.data.birthdate,
      contact_number: parsed.data.contactNumber,
    })
    .eq("id", profile.id)
    .select("id");

  if (error || !data?.length) {
    return { error: "We couldn't save your profile. Please try again.", values };
  }

  revalidatePath("/client", "layout");
  return { success: "Your profile has been updated.", values };
}
