"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { FormState } from "@/app/actions/auth";
import { requireRole } from "@/lib/auth/session";
import { isUuid } from "@/lib/pets/constants";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { userAdminErrorCode } from "@/lib/users/notices";
import {
  adminClientProfileSchema,
  adminStaffProfileSchema,
  createPrivilegedUserSchema,
} from "@/lib/validation/users";

function text(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function finish(userId: string, code: string, kind: "notice" | "error"): never {
  const key = kind === "notice" ? "notice" : "error";
  redirect(`/senior-vet/users/${userId}?${key}=${code}`);
}

async function endInactiveSessions(userId: string): Promise<void> {
  const admin = createAdminClient();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!admin || !url || !key) return;

  await admin.auth.admin.updateUserById(userId, { ban_duration: "876000h" });
  await fetch(`${url}/auth/v1/admin/users/${userId}/sessions`, {
    method: "DELETE",
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
}

async function allowSignIn(userId: string): Promise<boolean> {
  const admin = createAdminClient();
  if (!admin) return true;
  const { error } = await admin.auth.admin.updateUserById(userId, { ban_duration: "none" });
  return !error;
}

export async function updateAdminProfileAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireRole(["SENIOR_VET"]);
  const role = text(formData, "role");
  const values = {
    userId: text(formData, "userId"),
    lastName: text(formData, "lastName"),
    middleName: text(formData, "middleName"),
    firstName: text(formData, "firstName"),
    nameSuffix: text(formData, "nameSuffix"),
    contactNumber: text(formData, "contactNumber"),
    address: text(formData, "address"),
    birthdate: text(formData, "birthdate"),
  };
  const kept = {
    userId: values.userId,
    lastName: values.lastName,
    middleName: values.middleName,
    firstName: values.firstName,
    contactNumber: values.contactNumber,
    address: values.address,
    birthdate: values.birthdate,
    role,
  };

  const parsed =
    role === "CLIENT"
      ? adminClientProfileSchema.safeParse(values)
      : adminStaffProfileSchema.safeParse(values);
  if (!parsed.success) {
    return { fieldErrors: z.flattenError(parsed.error).fieldErrors, values: kept };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_update_profile", {
    p_user_id: parsed.data.userId,
    p_first_name: parsed.data.firstName,
    p_middle_name: parsed.data.middleName,
    p_last_name: parsed.data.lastName,
    p_contact_number: parsed.data.contactNumber,
    p_address: role === "CLIENT" && "address" in parsed.data ? parsed.data.address : null,
    p_birthdate: role === "CLIENT" && "birthdate" in parsed.data ? parsed.data.birthdate : null,
  });

  if (error) {
    return { error: "The account could not be saved. Please try again.", values: kept };
  }

  revalidatePath("/senior-vet/users");
  revalidatePath(`/senior-vet/users/${parsed.data.userId}`);
  return { success: "The account details have been saved.", values: kept };
}

export async function setAccountStatusAction(formData: FormData): Promise<void> {
  await requireRole(["SENIOR_VET"]);
  const userId = text(formData, "userId");
  const status = text(formData, "status");
  if (!isUuid(userId) || (status !== "ACTIVE" && status !== "INACTIVE")) {
    redirect("/senior-vet/users?error=invalid");
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_set_account_status", {
    p_user_id: userId,
    p_status: status,
  });
  if (error) finish(userId, userAdminErrorCode(error.message), "error");

  if (status === "INACTIVE") {
    await endInactiveSessions(userId);
  } else {
    const allowed = await allowSignIn(userId);
    if (!allowed) finish(userId, "signin", "error");
  }

  revalidatePath("/senior-vet/users");
  revalidatePath(`/senior-vet/users/${userId}`);
  finish(userId, status === "ACTIVE" ? "reactivated" : "deactivated", "notice");
}

export async function setAccountRoleAction(formData: FormData): Promise<void> {
  await requireRole(["SENIOR_VET"]);
  const userId = text(formData, "userId");
  const role = text(formData, "role");
  if (!isUuid(userId) || (role !== "STAFF" && role !== "SENIOR_VET")) {
    redirect("/senior-vet/users?error=invalid");
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_set_role", {
    p_user_id: userId,
    p_role: role,
  });
  if (error) finish(userId, userAdminErrorCode(error.message), "error");

  revalidatePath("/senior-vet/users");
  revalidatePath(`/senior-vet/users/${userId}`);
  finish(userId, "role", "notice");
}

export async function createPrivilegedUserAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireRole(["SENIOR_VET"]);
  const values = {
    lastName: text(formData, "lastName"),
    middleName: text(formData, "middleName"),
    firstName: text(formData, "firstName"),
    contactNumber: text(formData, "contactNumber"),
    email: text(formData, "email"),
    role: text(formData, "role"),
    password: text(formData, "password"),
  };
  const kept = {
    lastName: values.lastName,
    middleName: values.middleName,
    firstName: values.firstName,
    contactNumber: values.contactNumber,
    email: values.email,
    role: values.role,
  };

  const parsed = createPrivilegedUserSchema.safeParse(values);
  if (!parsed.success) {
    return { fieldErrors: z.flattenError(parsed.error).fieldErrors, values: kept };
  }

  const admin = createAdminClient();
  if (!admin) return { error: "The system is not configured yet. Please contact the clinic administrator.", values: kept };

  const { data, error } = await admin.auth.admin.createUser({
    email: parsed.data.email,
    password: parsed.data.password,
    email_confirm: true,
    user_metadata: {
      first_name: parsed.data.firstName,
      middle_name: parsed.data.middleName,
      last_name: parsed.data.lastName,
      contact_number: parsed.data.contactNumber,
    },
  });

  if (error || !data.user) {
    const code = userAdminErrorCode(error?.message ?? "");
    return {
      error: code === "exists" ? "An account with that email already exists." : "The account could not be created. Please try again.",
      values: kept,
    };
  }

  const userId = data.user.id;
  const { error: profileError } = await admin
    .from("profiles")
    .update({
      role: parsed.data.role,
      status: "ACTIVE",
      first_name: parsed.data.firstName,
      middle_name: parsed.data.middleName,
      last_name: parsed.data.lastName,
      contact_number: parsed.data.contactNumber,
    })
    .eq("id", userId);

  if (profileError) {
    await admin.auth.admin.deleteUser(userId);
    return { error: "The account could not be created. Please try again.", values: kept };
  }

  const supabase = await createClient();
  const { error: auditError } = await supabase.rpc("audit_user_created", {
    p_user_id: userId,
    p_role: parsed.data.role,
  });

  revalidatePath("/senior-vet/users");
  if (auditError) {
    redirect(`/senior-vet/users/${userId}?error=audit`);
  }
  redirect(`/senior-vet/users/${userId}?notice=created`);
}
