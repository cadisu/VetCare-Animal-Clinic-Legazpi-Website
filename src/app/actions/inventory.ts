"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireRole } from "@/lib/auth/session";
import { inventoryErrorCode } from "@/lib/inventory/notices";
import { createClient } from "@/lib/supabase/server";
import { inventoryMovementSchema } from "@/lib/validation/inventory";

function withCode(path: string, key: "error" | "notice", code: string): string {
  const [base, query = ""] = path.split("?");
  const params = new URLSearchParams(query);
  params.delete("error");
  params.delete("notice");
  params.set(key, code);
  return `${base}?${params.toString()}`;
}

function refreshInventory() {
  revalidatePath("/staff/inventory", "layout");
  revalidatePath("/staff/products");
  revalidatePath("/staff/pos", "layout");
  revalidatePath("/staff");
  revalidatePath("/senior-vet");
}

function fail(path: string, error: { message?: string } | null): never {
  redirect(withCode(path, "error", inventoryErrorCode(error?.message ?? "")));
}

export async function recordInventoryMovementAction(formData: FormData): Promise<void> {
  await requireRole(["STAFF", "SENIOR_VET"]);
  const productId = String(formData.get("productId") ?? "");
  const back = `/staff/inventory/${productId}`;
  const parsed = inventoryMovementSchema.safeParse({
    productId,
    movementType: String(formData.get("movementType") ?? ""),
    direction: String(formData.get("direction") ?? ""),
    quantity: String(formData.get("quantity") ?? ""),
    batchId: String(formData.get("batchId") ?? ""),
    supplier: String(formData.get("supplier") ?? ""),
    referenceNote: String(formData.get("referenceNote") ?? ""),
    unitCost: String(formData.get("unitCost") ?? ""),
    expirationDate: String(formData.get("expirationDate") ?? ""),
    reason: String(formData.get("reason") ?? ""),
  });
  if (!parsed.success) {
    const fields = z.flattenError(parsed.error).fieldErrors;
    const code = fields.reason
      ? "movement-reason"
      : fields.batchId
        ? "choose-batch"
        : fields.expirationDate
          ? "expiration-date"
          : fields.unitCost
            ? "unit-cost"
            : fields.supplier
              ? "supplier"
              : fields.referenceNote
                ? "reference"
                : fields.direction
                  ? "movement-direction"
                  : fields.movementType
                    ? "movement-type"
                    : "bad-quantity";
    redirect(withCode(back, "error", code));
  }
  const direction =
    parsed.data.movementType === "ADJUSTMENT" ? (parsed.data.direction === "OUT" ? "OUT" : "IN") : parsed.data.direction || "OUT";
  const supabase = await createClient();
  const { error } = await supabase.rpc("record_inventory_movement", {
    p_product_id: parsed.data.productId,
    p_movement_type: parsed.data.movementType,
    p_quantity: parsed.data.quantity,
    p_reason: parsed.data.reason,
    p_batch_id: parsed.data.batchId,
    p_supplier: parsed.data.supplier || null,
    p_reference_note: parsed.data.referenceNote || null,
    p_unit_cost: parsed.data.unitCost,
    p_expiration_date: parsed.data.expirationDate,
    p_direction: direction,
  });
  if (error) fail(back, error);
  refreshInventory();
  redirect(withCode(back, "notice", "recorded"));
}

export type StockInFormState = { saved: boolean; error: string | null };

export async function saveStockInForm(
  _previous: StockInFormState,
  formData: FormData,
): Promise<StockInFormState> {
  await requireRole(["STAFF", "SENIOR_VET"]);
  const parsed = inventoryMovementSchema.safeParse({
    productId: String(formData.get("productId") ?? ""),
    movementType: "STOCK_IN",
    direction: "IN",
    quantity: String(formData.get("quantity") ?? ""),
    batchId: "",
    supplier: String(formData.get("supplier") ?? ""),
    referenceNote: String(formData.get("referenceNote") ?? ""),
    unitCost: String(formData.get("unitCost") ?? ""),
    expirationDate: String(formData.get("expirationDate") ?? ""),
    reason: String(formData.get("reason") ?? ""),
  });
  if (!parsed.success) {
    const fields = z.flattenError(parsed.error).fieldErrors;
    const code = fields.reason
      ? "movement-reason"
      : fields.expirationDate
        ? "expiration-date"
        : fields.unitCost
          ? "unit-cost"
          : fields.supplier
            ? "supplier"
            : fields.referenceNote
              ? "reference"
              : "bad-quantity";
    return { saved: false, error: code };
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("record_inventory_movement", {
    p_product_id: parsed.data.productId,
    p_movement_type: "STOCK_IN",
    p_quantity: parsed.data.quantity,
    p_reason: parsed.data.reason,
    p_batch_id: null,
    p_supplier: parsed.data.supplier || null,
    p_reference_note: parsed.data.referenceNote || null,
    p_unit_cost: parsed.data.unitCost,
    p_expiration_date: parsed.data.expirationDate,
    p_direction: "IN",
  });
  if (error) return { saved: false, error: inventoryErrorCode(error.message ?? "") };
  refreshInventory();
  return { saved: true, error: null };
}
