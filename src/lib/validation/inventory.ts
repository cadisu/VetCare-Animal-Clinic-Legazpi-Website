import { z } from "zod";
import { INVENTORY_MOVEMENT_TYPES } from "@/lib/inventory/status";

const optionalText = (max: number, message: string) =>
  z
    .string()
    .optional()
    .transform((value) => (value ?? "").trim())
    .refine((value) => value.length <= max, message);

const optionalMoney = z
  .string()
  .optional()
  .transform((value) => (value ?? "").trim())
  .refine((value) => value === "" || /^\d+(\.\d{1,2})?$/.test(value), "Enter a valid cost")
  .transform((value) => (value === "" ? null : Number(value)))
  .refine((value) => value === null || value <= 9999999999.99, "Enter a valid cost");

export const inventoryMovementSchema = z.object({
  productId: z.string().uuid(),
  movementType: z.enum(INVENTORY_MOVEMENT_TYPES),
  direction: z.enum(["IN", "OUT"]).optional().or(z.literal("")),
  quantity: z
    .string()
    .trim()
    .regex(/^\d+$/, "Enter a valid quantity")
    .transform(Number)
    .refine((value) => value >= 1 && value <= 1000000, "Enter a valid quantity"),
  batchId: z
    .string()
    .optional()
    .transform((value) => (value ?? "").trim())
    .refine((value) => value === "" || z.string().uuid().safeParse(value).success, "Choose a batch")
    .transform((value) => (value === "" ? null : value)),
  supplier: optionalText(120, "Supplier name is too long"),
  referenceNote: optionalText(80, "Reference is too long"),
  unitCost: optionalMoney,
  expirationDate: z
    .string()
    .optional()
    .transform((value) => (value ?? "").trim())
    .refine((value) => value === "" || /^\d{4}-\d{2}-\d{2}$/.test(value), "Enter a valid expiration date")
    .transform((value) => (value === "" ? null : value)),
  reason: z.string().trim().min(3, "Enter a reason").max(500, "Reason is too long"),
});

export const warningDaysSchema = z.object({
  days: z
    .string()
    .trim()
    .regex(/^\d+$/, "Enter a valid warning period")
    .transform(Number)
    .refine((value) => value >= 1 && value <= 365, "Enter a valid warning period"),
});
