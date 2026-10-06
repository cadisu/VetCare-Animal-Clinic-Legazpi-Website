import { z } from "zod";
import { isIsoDate } from "@/lib/dates";
import { isUuid } from "@/lib/pets/constants";

export const blockDateSchema = z.object({
  blockDate: z.string().refine(isIsoDate, "Invalid date"),
  veterinarianId: z
    .string()
    .optional()
    .transform((v) => (v?.trim() ? v.trim() : ""))
    .refine((v) => v === "" || isUuid(v), "Invalid veterinarian"),
  reason: z.string().trim().max(500).optional(),
});

export const slotBlockSchema = z.object({
  slotId: z.string().refine(isUuid, "Invalid slot"),
  isBlocked: z.enum(["true", "false"]).transform((v) => v === "true"),
});

export const slotCapacitySchema = z.object({
  slotId: z.string().refine(isUuid, "Invalid slot"),
  capacity: z
    .string()
    .transform((v) => Number(v))
    .refine((n) => Number.isInteger(n) && n >= 1 && n <= 50, "Capacity must be 1–50"),
});

export const publishSlotsSchema = z.object({
  fromDate: z.string().refine(isIsoDate, "Invalid from date"),
  toDate: z.string().refine(isIsoDate, "Invalid to date"),
});
