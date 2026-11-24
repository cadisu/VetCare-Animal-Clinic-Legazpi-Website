import { z } from "zod";

/**
 * Accepts 09XXXXXXXXX, 9XXXXXXXXX, +639XXXXXXXXX, or 639XXXXXXXXX.
 * A number that starts with 9 is treated as the same mobile number as 09… .
 * Every accepted value is stored as 09XXXXXXXXX.
 */
export const phoneSchema = z
  .string()
  .trim()
  .transform((v) => v.replace(/[\s-]/g, ""))
  .transform((v) => (/^9\d{9}$/.test(v) ? `0${v}` : v))
  .refine((v) => /^(09\d{9}|\+639\d{9}|639\d{9})$/.test(v), {
    message: "Enter a valid Philippine mobile number (e.g. 09171234567).",
  })
  .transform((v) => (v.startsWith("09") ? v : `0${v.replace(/^\+?63/, "")}`));

/** Digits shown beside +63. A saved 09… number is shown without the leading 0. */
export function phoneEntryDigits(value: string | undefined): string {
  const digits = (value ?? "").replace(/\D/g, "");
  if (/^63\d{10}$/.test(digits)) return digits.slice(2);
  if (/^09\d{9}$/.test(digits)) return digits.slice(1);
  return digits.slice(0, 11);
}
