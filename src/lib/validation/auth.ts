import { z } from "zod";

/**
 * Validation schemas shared by the forms (feedback) and the server actions
 * (authoritative check). Never trust client-side validation alone.
 */

/** Accepts 09XXXXXXXXX, +639XXXXXXXXX or 639XXXXXXXXX; normalises to 09XXXXXXXXX. */
export const phoneSchema = z
  .string()
  .trim()
  .transform((v) => v.replace(/[\s-]/g, ""))
  .refine((v) => /^(09\d{9}|\+639\d{9}|639\d{9})$/.test(v), {
    message: "Enter a valid Philippine mobile number (e.g. 09171234567).",
  })
  .transform((v) => (v.startsWith("09") ? v : `0${v.replace(/^\+?63/, "")}`));

export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters.")
  .max(72, "Password must be 72 characters or fewer.")
  .refine((v) => /[A-Za-z]/.test(v) && /\d/.test(v), {
    message: "Password must include at least one letter and one number.",
  });

const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(254)
  .pipe(z.email("Enter a valid email address."));

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Enter your password.").max(72),
});

// NOTE: there is intentionally NO role field. Public registration always creates a CLIENT
// (enforced again by the database trigger).
export const registerSchema = z
  .object({
    fullName: z
      .string()
      .trim()
      .min(2, "Enter your full name.")
      .max(120, "Name is too long."),
    email: emailSchema,
    contactNumber: phoneSchema,
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match.",
  });

export const forgotPasswordSchema = z.object({ email: emailSchema });

export const resetPasswordSchema = z
  .object({ password: passwordSchema, confirmPassword: z.string() })
  .refine((d) => d.password === d.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match.",
  });
