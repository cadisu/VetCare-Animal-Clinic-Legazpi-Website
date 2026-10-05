import { z } from "zod";

/** Accepts 09XXXXXXXXX, +639XXXXXXXXX or 639XXXXXXXXX; normalises to 09XXXXXXXXX. */
export const phoneSchema = z
  .string()
  .trim()
  .transform((v) => v.replace(/[\s-]/g, ""))
  .refine((v) => /^(09\d{9}|\+639\d{9}|639\d{9})$/.test(v), {
    message: "Enter a valid Philippine mobile number (e.g. 09171234567).",
  })
  .transform((v) => (v.startsWith("09") ? v : `0${v.replace(/^\+?63/, "")}`));
