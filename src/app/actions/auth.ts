"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { getSiteUrl } from "@/lib/site-url";
import { isUserRole, resolvePostLoginPath } from "@/lib/auth/roles";
import {
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
} from "@/lib/validation/auth";

export type FormState = {
  error?: string;
  success?: string;
  fieldErrors?: Record<string, string[] | undefined>;
  /** Non-sensitive values re-filled into the form after a failed submit. */
  values?: Record<string, string>;
};

const NOT_CONFIGURED =
  "The system is not configured yet. Please contact the clinic administrator.";
const GENERIC_ERROR = "Something went wrong. Please try again.";

function text(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

/* ------------------------------------------------------------------ */
/* Login                                                               */
/* ------------------------------------------------------------------ */
export async function loginAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const raw = { email: text(formData, "email"), password: text(formData, "password") };
  const values = { email: raw.email };

  const parsed = loginSchema.safeParse(raw);
  if (!parsed.success) {
    return { fieldErrors: z.flattenError(parsed.error).fieldErrors, values };
  }
  if (!isSupabaseConfigured()) return { error: NOT_CONFIGURED, values };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error || !data.user) {
    const message =
      error?.code === "email_not_confirmed"
        ? "Please confirm your email address first. Check your inbox for the confirmation link."
        : "Invalid email or password.";
    return { error: message, values };
  }

  // Load the application profile to check the account status and pick the dashboard.
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, status")
    .eq("id", data.user.id)
    .maybeSingle();

  if (!profile || !isUserRole(profile.role)) {
    await supabase.auth.signOut();
    return {
      error: "Your account is not set up correctly. Please contact the clinic.",
      values,
    };
  }
  if (profile.status !== "ACTIVE") {
    await supabase.auth.signOut();
    return {
      error: "Your account is inactive. Please contact the clinic to reactivate it.",
      values,
    };
  }

  redirect(resolvePostLoginPath(profile.role, text(formData, "next")));
}

/* ------------------------------------------------------------------ */
/* Client registration (public) - always creates a CLIENT              */
/* ------------------------------------------------------------------ */
export async function registerAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const raw = {
    lastName: text(formData, "lastName"),
    middleName: text(formData, "middleName"),
    firstName: text(formData, "firstName"),
    address: text(formData, "address"),
    birthdate: text(formData, "birthdate"),
    contactNumber: text(formData, "contactNumber"),
    email: text(formData, "email"),
    password: text(formData, "password"),
    confirmPassword: text(formData, "confirmPassword"),
  };
  const values: Record<string, string> = Object.fromEntries(
    Object.entries(raw).filter(([key]) => key !== "password" && key !== "confirmPassword"),
  );

  // Any "role" field a malicious user adds to the request is never read.
  const parsed = registerSchema.safeParse(raw);
  if (!parsed.success) {
    return { fieldErrors: z.flattenError(parsed.error).fieldErrors, values };
  }
  if (!isSupabaseConfigured()) return { error: NOT_CONFIGURED, values };

  const { lastName, middleName, firstName, address, birthdate, contactNumber, email, password } =
    parsed.data;
  const siteUrl = await getSiteUrl();
  const supabase = await createClient();

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${siteUrl}/auth/callback?next=/dashboard`,
      // Only descriptive data. The DB trigger forces role = CLIENT regardless.
      data: {
        last_name: lastName,
        middle_name: middleName ?? "",
        first_name: firstName,
        address,
        birthdate,
        contact_number: contactNumber,
      },
    },
  });

  if (error) {
    if (error.code === "weak_password") {
      return { fieldErrors: { password: ["Please choose a stronger password."] }, values };
    }
    return { error: "We couldn't create your account. Please try again.", values };
  }

  // Email confirmation disabled in Supabase -> session exists, go straight in.
  if (data.session) redirect("/client");

  // Confirmation required. The same message is shown whether or not the email was already
  // registered, so the form cannot be used to discover registered emails.
  return {
    success:
      "Almost done! If this email can be registered, we've sent a confirmation link. Please check your inbox, then log in to register your pets.",
  };
}

/* ------------------------------------------------------------------ */
/* Password recovery                                                   */
/* ------------------------------------------------------------------ */
export async function forgotPasswordAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const raw = { email: text(formData, "email") };
  const parsed = forgotPasswordSchema.safeParse(raw);
  if (!parsed.success) {
    return { fieldErrors: z.flattenError(parsed.error).fieldErrors, values: raw };
  }
  if (!isSupabaseConfigured()) return { error: NOT_CONFIGURED, values: raw };

  const siteUrl = await getSiteUrl();
  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${siteUrl}/auth/callback?next=/reset-password`,
  });

  // Always the same response (no account enumeration).
  return {
    success:
      "If an account exists for that email, we've sent a password reset link. Please check your inbox.",
  };
}

export async function resetPasswordAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = resetPasswordSchema.safeParse({
    password: text(formData, "password"),
    confirmPassword: text(formData, "confirmPassword"),
  });
  if (!parsed.success) {
    return { fieldErrors: z.flattenError(parsed.error).fieldErrors };
  }
  if (!isSupabaseConfigured()) return { error: NOT_CONFIGURED };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "This reset link is invalid or has expired. Please request a new one." };
  }

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    if (error.code === "weak_password" || error.code === "same_password") {
      return {
        fieldErrors: {
          password: [
            error.code === "same_password"
              ? "Choose a password different from your current one."
              : "Please choose a stronger password.",
          ],
        },
      };
    }
    return { error: GENERIC_ERROR };
  }

  await supabase.auth.signOut();
  redirect("/login?message=password-updated");
}

/* ------------------------------------------------------------------ */
/* Logout                                                              */
/* ------------------------------------------------------------------ */
export async function logoutAction() {
  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    await supabase.auth.signOut();
  }
  redirect("/");
}
