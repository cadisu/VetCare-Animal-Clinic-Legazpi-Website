import { z } from "zod";
import { isIsoDate, todayIso } from "@/lib/dates";
import { phoneSchema } from "./common";

/** Letters (any language), spaces, apostrophes, hyphens and periods, e.g. "Dela Cruz", "O'Neil", "Jr.". */
const NAME_PATTERN = /^[\p{L}][\p{L}\s'.-]*$/u;

function nameSchema(label: string) {
  return z
    .string()
    .trim()
    .min(1, `Enter your ${label}.`)
    .max(60, `${label[0].toUpperCase()}${label.slice(1)} is too long.`)
    .regex(NAME_PATTERN, `Use letters only for your ${label}.`);
}

const middleNameSchema = z
  .string()
  .trim()
  .max(60, "Middle name is too long.")
  .refine((v) => v === "" || NAME_PATTERN.test(v), "Use letters only for your middle name.")
  .transform((v) => (v === "" ? null : v));

const birthdateSchema = z
  .string()
  .trim()
  .min(1, "Enter your birthdate.")
  .refine(isIsoDate, "Enter a valid date.")
  .refine((v) => v >= "1900-01-01", "Enter a valid birthdate.")
  .refine((v) => v <= todayIso(), "Birthdate cannot be in the future.");

/** Personal fields shared by registration and the client's "My Profile" page. */
export const clientProfileFields = {
  lastName: nameSchema("last name"),
  firstName: nameSchema("first name"),
  middleName: middleNameSchema,
  address: z
    .string()
    .trim()
    .min(5, "Enter your complete address.")
    .max(255, "Address is too long."),
  birthdate: birthdateSchema,
  contactNumber: phoneSchema,
};

export const clientProfileSchema = z.object(clientProfileFields);
export type ClientProfileInput = z.infer<typeof clientProfileSchema>;
