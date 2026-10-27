import { z } from "zod";

const SAFE_RETURN_PREFIXES = [
  "/staff/pos",
  "/staff/appointments",
  "/staff/products",
  "/senior-vet/appointments",
];

/** Keeps POS redirects inside the staff and senior vet pages that can open a bill. */
export function posReturnPath(value: string, fallback: string): string {
  const path = value.split("?")[0]?.split("#")[0] ?? "";
  if (!path.startsWith("/") || path.startsWith("//") || path.includes("\\")) return fallback;
  if (!SAFE_RETURN_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`))) {
    return fallback;
  }
  return path;
}

export const productSchema = z.object({
  name: z.string().trim().min(1, "Enter a product name").max(120, "Enter a product name"),
  category: z.string().trim().min(1, "Choose a category").max(40, "Choose a category"),
  description: z.string().trim().max(500, "The description is too long").optional().or(z.literal("")),
  unit: z.string().trim().min(1, "Enter a unit").max(40, "Enter a unit"),
  price: z
    .string()
    .trim()
    .regex(/^\d+(\.\d{1,2})?$/, "Enter a valid price")
    .transform(Number)
    .refine((value) => value >= 0 && value <= 9999999999.99, "Enter a valid price"),
  quantityOnHand: z
    .string()
    .trim()
    .regex(/^\d+$/, "Enter a valid quantity")
    .transform(Number)
    .refine((value) => value >= 0 && value <= 1000000, "Enter a valid quantity"),
  minimumStock: z
    .string()
    .optional()
    .transform((value) => (value ?? "").trim())
    .refine((value) => value === "" || (/^\d+$/.test(value) && Number(value) <= 1000000), "Enter a valid minimum stock")
    .transform((value) => (value === "" ? null : Number(value))),
  supplier: z
    .string()
    .optional()
    .transform((value) => (value ?? "").trim())
    .refine((value) => value.length <= 120, "Supplier name is too long"),
  unitCost: z
    .string()
    .optional()
    .transform((value) => (value ?? "").trim())
    .refine((value) => value === "" || /^\d+(\.\d{1,2})?$/.test(value), "Enter a valid cost")
    .transform((value) => (value === "" ? null : Number(value)))
    .refine((value) => value === null || value <= 9999999999.99, "Enter a valid cost"),
  isActive: z.enum(["true", "false"]).transform((value) => value === "true"),
});

export const quantitySchema = z
  .string()
  .trim()
  .regex(/^\d+$/)
  .transform(Number)
  .refine((value) => value >= 1 && value <= 999);

export const voidReasonSchema = z.string().trim().min(3, "Enter a reason").max(500, "Reason is too long");

const optionalId = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((value) => (typeof value === "string" ? value.trim() : ""))
  .transform((value) => (value ? value : null))
  .refine((value) => value === null || z.string().uuid().safeParse(value).success, "Choose a valid record.");

export const saveCartSchema = z.object({
  transactionId: optionalId,
  clientId: optionalId,
  petId: optionalId,
  appointmentId: optionalId,
  walkInName: z.string().trim().max(120).optional().default(""),
  walkInContact: z.string().trim().max(40).optional().default(""),
  pay: z.boolean(),
  amountTendered: z.number().min(0).max(9999999999.99).nullable(),
  grantId: optionalId,
  items: z
    .array(
      z.object({
        itemType: z.enum(["SERVICE", "PRODUCT"]),
        serviceId: optionalId,
        productId: optionalId,
        petId: optionalId,
        quantity: z.number().int().min(1).max(999),
      }),
    )
    .min(1)
    .max(40),
});

export const editCartSchema = z.object({
  transactionId: z.string().uuid(),
  reason: voidReasonSchema,
  items: z
    .array(
      z.object({
        itemId: optionalId,
        itemType: z.enum(["SERVICE", "PRODUCT"]),
        serviceId: optionalId,
        productId: optionalId,
        petId: optionalId,
        quantity: z.number().int().min(1).max(999),
      }),
    )
    .min(1)
    .max(40),
});

export const stockAdjustmentSchema = z.object({
  productId: z.string().uuid(),
  delta: z
    .string()
    .trim()
    .regex(/^-?\d+$/, "Enter a valid quantity")
    .transform(Number)
    .refine((value) => value !== 0 && value >= -1000000 && value <= 1000000, "Enter a valid quantity"),
  reason: voidReasonSchema,
});
