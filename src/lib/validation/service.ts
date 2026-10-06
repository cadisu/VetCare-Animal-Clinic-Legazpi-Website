import { z } from "zod";

export const serviceSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  description: z.string().trim().max(2000).optional().or(z.literal("")),
  category: z.enum(["CONSULTATION", "VACCINATION", "PREVENTION", "GROOMING", "SURGERY", "OTHER"]),
  requiresVeterinarian: z.enum(["true", "false"]).transform((v) => v === "true"),
  isActive: z.enum(["true", "false"]).transform((v) => v === "true"),
  isBookable: z.enum(["true", "false"]).transform((v) => v === "true"),
  price: z
    .string()
    .optional()
    .transform((v) => (v?.trim() ? v.trim() : ""))
    .refine((v) => v === "" || /^\d+(\.\d{1,2})?$/.test(v), "Invalid price"),
  durationMinutes: z
    .string()
    .optional()
    .transform((v) => (v?.trim() ? v.trim() : ""))
    .refine((v) => v === "" || (/^\d+$/.test(v) && Number(v) > 0 && Number(v) <= 480), "Invalid duration"),
  sortOrder: z
    .string()
    .optional()
    .transform((v) => (v?.trim() ? Number(v) : 0))
    .refine((n) => Number.isFinite(n) && n >= 0 && n <= 9999, "Invalid sort order"),
});
