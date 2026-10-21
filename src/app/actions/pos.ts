"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireRole } from "@/lib/auth/session";
import { posErrorCode } from "@/lib/pos/notices";
import { isUuid } from "@/lib/pets/constants";
import { createClient } from "@/lib/supabase/server";
import { posReturnPath, productSchema, quantitySchema, voidReasonSchema } from "@/lib/validation/pos";

function withCode(path: string, key: "error" | "notice", code: string): string {
  const [base, query = ""] = path.split("?");
  const params = new URLSearchParams(query);
  params.delete("error");
  params.delete("notice");
  params.set(key, code);
  return `${base}?${params.toString()}`;
}

function refreshPos() {
  revalidatePath("/staff/pos", "layout");
  revalidatePath("/staff/products");
  revalidatePath("/staff/appointments", "layout");
  revalidatePath("/senior-vet/appointments", "layout");
}

function fail(path: string, error: { message?: string } | null): never {
  redirect(withCode(path, "error", posErrorCode(error?.message ?? "")));
}

function billPath(transactionId: string): string {
  return `/staff/pos/${transactionId}`;
}

function readQuantity(formData: FormData): number | null {
  const parsed = quantitySchema.safeParse(String(formData.get("quantity") ?? ""));
  return parsed.success ? parsed.data : null;
}

export async function openPosForAppointmentAction(formData: FormData): Promise<void> {
  await requireRole(["STAFF", "SENIOR_VET"]);
  const appointmentId = String(formData.get("appointmentId") ?? "");
  const returnTo = posReturnPath(String(formData.get("returnTo") ?? ""), "/staff/appointments");
  if (!isUuid(appointmentId)) redirect(withCode(returnTo, "error", "appointment-missing"));

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("pos_open_for_appointment", {
    p_appointment_id: appointmentId,
  });
  if (error || typeof data !== "string") fail(returnTo, error);
  refreshPos();
  redirect(billPath(data));
}

export async function openCounterSaleAction(formData: FormData): Promise<void> {
  await requireRole(["STAFF", "SENIOR_VET"]);
  const clientId = String(formData.get("clientId") ?? "");
  const petValue = String(formData.get("petId") ?? "").trim();
  const returnTo = posReturnPath(String(formData.get("returnTo") ?? ""), "/staff/pos");
  if (!isUuid(clientId)) redirect(withCode(returnTo, "error", "client-missing"));
  if (petValue && !isUuid(petValue)) redirect(withCode(returnTo, "error", "pet-owner"));

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("pos_open_counter_sale", {
    p_client_id: clientId,
    p_pet_id: petValue || null,
  });
  if (error || typeof data !== "string") fail(returnTo, error);
  refreshPos();
  redirect(billPath(data));
}

export async function addServiceItemAction(formData: FormData): Promise<void> {
  await requireRole(["STAFF", "SENIOR_VET"]);
  const transactionId = String(formData.get("transactionId") ?? "");
  const serviceId = String(formData.get("serviceId") ?? "");
  const path = isUuid(transactionId) ? billPath(transactionId) : "/staff/pos";
  const quantity = readQuantity(formData);
  if (!isUuid(transactionId) || !isUuid(serviceId) || quantity === null) {
    redirect(withCode(path, "error", "bad-quantity"));
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("pos_add_service_item", {
    p_transaction_id: transactionId,
    p_service_id: serviceId,
    p_quantity: quantity,
  });
  if (error) fail(path, error);
  refreshPos();
  redirect(path);
}

export async function addProductItemAction(formData: FormData): Promise<void> {
  await requireRole(["STAFF", "SENIOR_VET"]);
  const transactionId = String(formData.get("transactionId") ?? "");
  const productId = String(formData.get("productId") ?? "");
  const path = isUuid(transactionId) ? billPath(transactionId) : "/staff/pos";
  const quantity = readQuantity(formData);
  if (!isUuid(transactionId) || !isUuid(productId) || quantity === null) {
    redirect(withCode(path, "error", "bad-quantity"));
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("pos_add_product_item", {
    p_transaction_id: transactionId,
    p_product_id: productId,
    p_quantity: quantity,
  });
  if (error) fail(path, error);
  refreshPos();
  redirect(path);
}

export async function setItemQuantityAction(formData: FormData): Promise<void> {
  await requireRole(["STAFF", "SENIOR_VET"]);
  const transactionId = String(formData.get("transactionId") ?? "");
  const itemId = String(formData.get("itemId") ?? "");
  const path = isUuid(transactionId) ? billPath(transactionId) : "/staff/pos";
  const quantity = readQuantity(formData);
  if (!isUuid(itemId) || quantity === null) redirect(withCode(path, "error", "bad-quantity"));

  const supabase = await createClient();
  const { error } = await supabase.rpc("pos_set_item_quantity", {
    p_item_id: itemId,
    p_quantity: quantity,
  });
  if (error) fail(path, error);
  refreshPos();
  redirect(path);
}

export async function removeItemAction(formData: FormData): Promise<void> {
  await requireRole(["STAFF", "SENIOR_VET"]);
  const transactionId = String(formData.get("transactionId") ?? "");
  const itemId = String(formData.get("itemId") ?? "");
  const path = isUuid(transactionId) ? billPath(transactionId) : "/staff/pos";
  if (!isUuid(itemId)) redirect(withCode(path, "error", "transaction-missing"));

  const supabase = await createClient();
  const { error } = await supabase.rpc("pos_remove_item", { p_item_id: itemId });
  if (error) fail(path, error);
  refreshPos();
  redirect(path);
}

export async function completePosAction(formData: FormData): Promise<void> {
  await requireRole(["STAFF", "SENIOR_VET"]);
  const transactionId = String(formData.get("transactionId") ?? "");
  const path = isUuid(transactionId) ? billPath(transactionId) : "/staff/pos";
  if (!isUuid(transactionId)) redirect(withCode(path, "error", "transaction-missing"));

  const supabase = await createClient();
  // The database computes the total and stores it as the amount paid.
  // The form does not send a price or a total.
  const { error } = await supabase.rpc("pos_complete_transaction", {
    p_transaction_id: transactionId,
  });
  if (error) fail(path, error);
  refreshPos();
  redirect(withCode(path, "notice", "paid"));
}

export async function voidPosAction(formData: FormData): Promise<void> {
  await requireRole(["STAFF", "SENIOR_VET"]);
  const transactionId = String(formData.get("transactionId") ?? "");
  const path = isUuid(transactionId) ? billPath(transactionId) : "/staff/pos";
  const reason = voidReasonSchema.safeParse(String(formData.get("reason") ?? ""));
  if (!isUuid(transactionId) || !reason.success) redirect(withCode(path, "error", "void-reason"));

  const supabase = await createClient();
  const { error } = await supabase.rpc("pos_void_transaction", {
    p_transaction_id: transactionId,
    p_reason: reason.data,
  });
  if (error) fail(path, error);
  refreshPos();
  redirect(withCode(path, "notice", "voided"));
}

export async function upsertProductAction(formData: FormData): Promise<void> {
  await requireRole(["SENIOR_VET"]);
  const productId = String(formData.get("productId") ?? "").trim();
  const parsed = productSchema.safeParse({
    name: String(formData.get("name") ?? ""),
    unit: String(formData.get("unit") ?? ""),
    price: String(formData.get("price") ?? ""),
    quantityOnHand: String(formData.get("quantityOnHand") ?? ""),
    isActive: String(formData.get("isActive") ?? "true"),
  });
  if (!parsed.success) {
    const fields = z.flattenError(parsed.error).fieldErrors;
    const code = fields.name
      ? "product-name"
      : fields.unit
        ? "product-unit"
        : fields.price
          ? "product-price"
          : "bad-quantity";
    redirect(withCode("/staff/products", "error", code));
  }
  if (productId && !isUuid(productId)) redirect(withCode("/staff/products", "error", "product-unavailable"));

  const supabase = await createClient();
  const { error } = await supabase.rpc("upsert_product", {
    p_product_id: productId || null,
    p_name: parsed.data.name,
    p_unit: parsed.data.unit,
    p_price: parsed.data.price,
    p_quantity_on_hand: parsed.data.quantityOnHand,
    p_is_active: parsed.data.isActive,
  });
  if (error) fail("/staff/products", error);
  refreshPos();
  redirect(withCode("/staff/products", "notice", "saved"));
}
