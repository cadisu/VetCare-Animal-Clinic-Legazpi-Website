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
  isActive: z.enum(["true", "false"]).transform((value) => value === "true"),
});

export const quantitySchema = z
  .string()
  .trim()
  .regex(/^\d+$/)
  .transform(Number)
  .refine((value) => value >= 1 && value <= 999);

export const voidReasonSchema = z.string().trim().min(3, "Enter a reason").max(500, "Reason is too long");
