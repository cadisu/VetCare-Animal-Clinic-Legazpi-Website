import { z } from "zod";
import { passwordSchema } from "@/lib/validation/auth";
import { clientProfileSchema, personNameSchema, staffProfileSchema } from "@/lib/validation/client";
import { phoneSchema } from "@/lib/validation/common";

const userIdSchema = z.string().uuid("Choose an account.");

const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(254)
  .pipe(z.email("Enter a valid email address."));

export const createPrivilegedUserSchema = personNameSchema.extend({
  contactNumber: phoneSchema,
  email: emailSchema,
  role: z.enum(["STAFF", "SENIOR_VET"], "Choose Staff or Senior Vet."),
  password: passwordSchema,
});

export const adminClientProfileSchema = clientProfileSchema.extend({ userId: userIdSchema });
export const adminStaffProfileSchema = staffProfileSchema.extend({ userId: userIdSchema });

export type CreatePrivilegedUserInput = z.infer<typeof createPrivilegedUserSchema>;
