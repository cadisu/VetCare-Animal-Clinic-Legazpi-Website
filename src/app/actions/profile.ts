"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { FormState } from "@/app/actions/auth";
import { requireRole } from "@/lib/auth/session";
import {
  isOwnAvatarPath,
  readProfileImage,
  removeProfileImage,
  uploadProfileImage,
} from "@/lib/profile/avatar";
import { createClient } from "@/lib/supabase/server";
import { clientProfileSchema, personNameSchema, staffProfileSchema } from "@/lib/validation/client";

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
    nameSuffix: text(formData, "nameSuffix"),
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
      name_suffix: parsed.data.nameSuffix,
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

/** Senior Vet may edit only their own name and profile picture. */
export async function updateSeniorVetProfileAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const profile = await requireRole(["SENIOR_VET"]);
  const values = {
    lastName: text(formData, "lastName"),
    middleName: text(formData, "middleName"),
    firstName: text(formData, "firstName"),
  };

  const parsed = personNameSchema.safeParse(values);
  if (!parsed.success) {
    return { fieldErrors: z.flattenError(parsed.error).fieldErrors, values };
  }

  const imageResult = await readProfileImage(formData);
  if (imageResult.error) return { error: imageResult.error, values };

  const supabase = await createClient();
  let previousPath: string | null = null;
  let newPath: string | undefined;

  if (imageResult.image) {
    const { data: existing, error: readError } = await supabase
      .from("profiles")
      .select("avatar_path")
      .eq("id", profile.id)
      .maybeSingle();
    if (readError) {
      return {
        error: "Profile pictures are not available until the latest database migration is applied.",
        values,
      };
    }
    previousPath = typeof existing?.avatar_path === "string" ? existing.avatar_path : null;
    const uploaded = await uploadProfileImage(supabase, profile.id, imageResult.image);
    if (!uploaded || !isOwnAvatarPath(profile.id, uploaded)) {
      return { error: "We couldn't upload that picture. Please try again.", values };
    }
    newPath = uploaded;
  }

  const { data, error } = await supabase
    .from("profiles")
    .update({
      last_name: parsed.data.lastName,
      middle_name: parsed.data.middleName,
      first_name: parsed.data.firstName,
      ...(newPath ? { avatar_path: newPath } : {}),
    })
    .eq("id", profile.id)
    .select("id");

  if (error || !data?.length) {
    if (newPath) await removeProfileImage(supabase, newPath);
    return { error: "We couldn't save your profile. Please try again.", values };
  }

  if (newPath && previousPath && previousPath !== newPath) {
    await removeProfileImage(supabase, previousPath);
  }

  revalidatePath("/senior-vet", "layout");
  revalidatePath("/staff", "layout");
  return { success: "Your profile has been updated.", values };
}

/** Staff may edit only their own name, contact number, and profile picture. */
export async function updateStaffProfileAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const profile = await requireRole(["STAFF"]);
  const values = {
    lastName: text(formData, "lastName"),
    middleName: text(formData, "middleName"),
    firstName: text(formData, "firstName"),
    contactNumber: text(formData, "contactNumber"),
  };

  const parsed = staffProfileSchema.safeParse(values);
  if (!parsed.success) {
    return { fieldErrors: z.flattenError(parsed.error).fieldErrors, values };
  }

  const imageResult = await readProfileImage(formData);
  if (imageResult.error) return { error: imageResult.error, values };

  const supabase = await createClient();
  let previousPath: string | null = null;
  let newPath: string | undefined;

  if (imageResult.image) {
    const { data: existing, error: readError } = await supabase
      .from("profiles")
      .select("avatar_path")
      .eq("id", profile.id)
      .maybeSingle();
    if (readError) {
      return {
        error: "Profile pictures are not available until the latest database migration is applied.",
        values,
      };
    }
    previousPath = typeof existing?.avatar_path === "string" ? existing.avatar_path : null;
    const uploaded = await uploadProfileImage(supabase, profile.id, imageResult.image);
    if (!uploaded || !isOwnAvatarPath(profile.id, uploaded)) {
      return { error: "We couldn't upload that picture. Please try again.", values };
    }
    newPath = uploaded;
  }

  const { data, error } = await supabase
    .from("profiles")
    .update({
      last_name: parsed.data.lastName,
      middle_name: parsed.data.middleName,
      first_name: parsed.data.firstName,
      contact_number: parsed.data.contactNumber,
      ...(newPath ? { avatar_path: newPath } : {}),
    })
    .eq("id", profile.id)
    .select("id");

  if (error || !data?.length) {
    if (newPath) await removeProfileImage(supabase, newPath);
    return { error: "We couldn't save your profile. Please try again.", values };
  }

  if (newPath && previousPath && previousPath !== newPath) {
    await removeProfileImage(supabase, previousPath);
  }

  revalidatePath("/staff", "layout");
  return { success: "Your profile has been updated.", values };
}
