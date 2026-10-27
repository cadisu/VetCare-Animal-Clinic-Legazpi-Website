"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireRole } from "@/lib/auth/session";
import { APPOINTMENT_LIST_SELECT } from "@/lib/appointments/server";
import type { AppointmentListRow } from "@/lib/appointments/constants";
import { formatTime12 } from "@/lib/appointments/constants";
import { formatDate } from "@/lib/dates";
import {
  getProductImageUrls,
  isProductImagePath,
  readProductImage,
  removeProductImage,
  uploadProductImage,
} from "@/lib/pos/images";
import { posErrorCode, posErrorText } from "@/lib/pos/notices";
import { isUuid } from "@/lib/pets/constants";
import { createClient } from "@/lib/supabase/server";
import {
  editCartSchema,
  posReturnPath,
  productSchema,
  saveCartSchema,
  stockAdjustmentSchema,
  voidReasonSchema,
} from "@/lib/validation/pos";

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
  revalidatePath("/staff/inventory", "layout");
  revalidatePath("/staff");
  revalidatePath("/senior-vet");
  revalidatePath("/staff/appointments", "layout");
  revalidatePath("/senior-vet/appointments", "layout");
}

function fail(path: string, error: { message?: string } | null): never {
  redirect(withCode(path, "error", posErrorCode(error?.message ?? "")));
}

function cleanSearch(value: string): string {
  return value.replace(/[,()%*\\"]/g, " ").replace(/\s+/g, " ").trim().slice(0, 60);
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
  redirect(`/staff/pos?bill=${data}`);
}

export async function searchPosClientsAction(
  query: string,
): Promise<{ id: string; fullName: string; email: string }[]> {
  await requireRole(["STAFF", "SENIOR_VET"]);
  const q = cleanSearch(query);
  if (q.length < 2) return [];
  const pattern = `%${q}%`;
  const filters = ["full_name", "last_name", "first_name", "email", "contact_number"].map(
    (column) => `${column}.ilike."${pattern}"`,
  );
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("id, full_name, email")
    .eq("role", "CLIENT")
    .eq("status", "ACTIVE")
    .or(filters.join(","))
    .order("full_name", { ascending: true })
    .limit(20);
  return (data ?? []).map((row) => ({
    id: row.id as string,
    fullName: row.full_name as string,
    email: row.email as string,
  }));
}

export async function loadClientSaleContextAction(clientId: string, exceptTransactionId: string | null): Promise<{
  pets: { id: string; name: string }[];
  visits: {
    id: string;
    label: string;
    petId: string;
    petName: string;
    serviceId: string;
    serviceName: string;
    servicePrice: number | null;
    serviceBlocked: boolean;
  }[];
}> {
  await requireRole(["STAFF", "SENIOR_VET"]);
  if (!isUuid(clientId)) return { pets: [], visits: [] };
  const supabase = await createClient();
  const [{ data: pets }, { data: visitRows }] = await Promise.all([
    supabase.from("pets").select("id, name").eq("owner_id", clientId).eq("is_archived", false).order("name"),
    supabase
      .from("appointments")
      .select(APPOINTMENT_LIST_SELECT)
      .eq("client_id", clientId)
      .in("status", ["IN_CONSULTATION", "COMPLETED"])
      .order("created_at", { ascending: false })
      .limit(20),
  ]);
  const visits = (visitRows ?? []) as unknown as AppointmentListRow[];
  const blocked = await Promise.all(
    visits.map((visit) =>
      supabase
        .from("pos_transactions")
        .select("id, pos_transaction_items!inner(service_id)")
        .eq("appointment_id", visit.id)
        .neq("status", "VOIDED")
        .neq("id", exceptTransactionId || "00000000-0000-0000-0000-000000000000"),
    ),
  );
  return {
    pets: (pets ?? []) as { id: string; name: string }[],
    visits: visits.map((visit, index) => {
      const rows = blocked[index]?.data ?? [];
      const serviceBlocked = rows.some((row) => {
        const items = row.pos_transaction_items as { service_id: string }[] | { service_id: string } | null;
        const list = Array.isArray(items) ? items : items ? [items] : [];
        return list.some((item) => item.service_id === visit.service.id);
      });
      return {
        id: visit.id,
        label: `${visit.service.name} · ${visit.pet.name} · ${formatDate(visit.slot.slot_date)} ${formatTime12(visit.slot.start_time)}`,
        petId: visit.pet.id,
        petName: visit.pet.name,
        serviceId: visit.service.id,
        serviceName: visit.service.name,
        servicePrice: null,
        serviceBlocked,
      };
    }),
  };
}

export async function savePosCartAction(input: unknown): Promise<{ error: string } | void> {
  await requireRole(["STAFF", "SENIOR_VET"]);
  const parsed = saveCartSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "Check the cart and try again." };
  }
  const cart = parsed.data;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("pos_save_cart_with_reward", {
    p_transaction_id: cart.transactionId,
    p_client_id: cart.clientId,
    p_pet_id: cart.petId,
    p_appointment_id: cart.appointmentId,
    p_walk_in_name: cart.clientId ? null : cart.walkInName,
    p_walk_in_contact: cart.clientId ? null : cart.walkInContact || null,
    p_items: cart.items.map((item) => ({
      item_type: item.itemType,
      service_id: item.itemType === "SERVICE" ? item.serviceId : null,
      product_id: item.itemType === "PRODUCT" ? item.productId : null,
      pet_id: item.petId,
      quantity: item.quantity,
    })),
    p_pay: cart.pay,
    p_amount_tendered: cart.pay ? cart.amountTendered : null,
    p_grant_id: cart.clientId ? cart.grantId : null,
  });
  if (error || typeof data !== "string") {
    return { error: posErrorText(posErrorCode(error?.message ?? "")) ?? "Something went wrong. Please try again." };
  }
  refreshPos();
  redirect(cart.pay ? `/staff/pos/${data}?notice=paid` : `/staff/pos?bill=${data}&notice=bill-saved`);
}

export async function editCompletedPosAction(input: unknown): Promise<{ error: string } | void> {
  await requireRole(["SENIOR_VET"]);
  const parsed = editCartSchema.safeParse(input);
  if (!parsed.success) return { error: "Check the items and the reason, then try again." };
  const edit = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.rpc("pos_edit_completed_transaction", {
    p_transaction_id: edit.transactionId,
    p_reason: edit.reason,
    p_items: edit.items.map((item) => ({
      item_id: item.itemId,
      item_type: item.itemType,
      service_id: item.itemType === "SERVICE" ? item.serviceId : null,
      product_id: item.itemType === "PRODUCT" ? item.productId : null,
      pet_id: item.petId,
      quantity: item.quantity,
    })),
  });
  if (error) {
    return { error: posErrorText(posErrorCode(error.message)) ?? "Something went wrong. Please try again." };
  }
  refreshPos();
  redirect(`/staff/pos/${edit.transactionId}?notice=edited`);
}

export async function voidPosAction(formData: FormData): Promise<void> {
  await requireRole(["STAFF", "SENIOR_VET"]);
  const transactionId = String(formData.get("transactionId") ?? "");
  const path = isUuid(transactionId) ? `/staff/pos/${transactionId}` : "/staff/pos";
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

export type ProductFormState = {
  productId: string | null;
  productName: string | null;
  pendingProductId: string | null;
  error: string | null;
};

function productFormError(error: string, pendingProductId: string | null = null): ProductFormState {
  return { productId: null, productName: null, pendingProductId, error };
}

function openingReceipt(formData: FormData): { quantity: number | null; expiration: string | null; error: string | null } {
  const quantity = String(formData.get("openingQuantity") ?? "").trim();
  const expiration = String(formData.get("expirationDate") ?? "").trim();
  if (expiration && !/^\d{4}-\d{2}-\d{2}$/.test(expiration)) {
    return { quantity: null, expiration: null, error: "expiration-date" };
  }
  if (!quantity || quantity === "0") {
    if (expiration) return { quantity: null, expiration: null, error: "opening-quantity" };
    return { quantity: null, expiration: null, error: null };
  }
  if (!/^\d+$/.test(quantity) || Number(quantity) < 1 || Number(quantity) > 1000000) {
    return { quantity: null, expiration: null, error: "bad-quantity" };
  }
  return { quantity: Number(quantity), expiration: expiration || null, error: null };
}

function batchExpirationUpdates(formData: FormData): { updates: { id: string; expiration: string | null }[]; error: string | null } {
  const updates: { id: string; expiration: string | null }[] = [];
  for (const [key, value] of formData.entries()) {
    if (!key.startsWith("batchExpiration:")) continue;
    const id = key.slice("batchExpiration:".length);
    if (!isUuid(id)) return { updates: [], error: "expiration-date" };
    const expiration = String(value).trim();
    if (expiration && !/^\d{4}-\d{2}-\d{2}$/.test(expiration)) return { updates: [], error: "expiration-date" };
    updates.push({ id, expiration: expiration || null });
  }
  return { updates, error: null };
}

function productFieldCode(fields: Record<string, string[] | undefined>): string {
  return fields.name
    ? "product-name"
    : fields.category
      ? "product-category"
      : fields.unit
        ? "product-unit"
        : fields.price
          ? "product-price"
          : fields.description
            ? "product-description"
            : fields.minimumStock
              ? "min-stock"
              : fields.unitCost
                ? "unit-cost"
                : fields.supplier
                  ? "supplier"
                  : "bad-quantity";
}

async function performProductSave(formData: FormData): Promise<ProductFormState> {
  await requireRole(["STAFF", "SENIOR_VET"]);
  const productId = String(formData.get("productId") ?? "").trim();
  const parsed = productSchema.safeParse({
    name: String(formData.get("name") ?? ""),
    category: String(formData.get("category") ?? ""),
    description: String(formData.get("description") ?? ""),
    unit: String(formData.get("unit") ?? ""),
    price: String(formData.get("price") ?? ""),
    quantityOnHand: String(formData.get("quantityOnHand") ?? "0"),
    minimumStock: String(formData.get("minimumStock") ?? ""),
    supplier: String(formData.get("supplier") ?? ""),
    unitCost: String(formData.get("unitCost") ?? ""),
    isActive: String(formData.get("isActive") ?? "true"),
  });
  if (!parsed.success) {
    return productFormError(productFieldCode(z.flattenError(parsed.error).fieldErrors), productId || null);
  }
  if (productId && !isUuid(productId)) return productFormError("product-unavailable");
  const opening = formData.get("openingReceipt") === "true" ? openingReceipt(formData) : null;
  if (opening?.error) return productFormError(opening.error, productId || null);
  const batchDates = batchExpirationUpdates(formData);
  if (batchDates.error) return productFormError(batchDates.error, productId || null);

  const image = await readProductImage(formData);
  if (image.error) return productFormError("image-path");

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("upsert_product", {
    p_product_id: productId || null,
    p_name: parsed.data.name,
    p_unit: parsed.data.unit,
    p_price: parsed.data.price,
    p_quantity_on_hand: parsed.data.quantityOnHand,
    p_is_active: parsed.data.isActive,
    p_category: parsed.data.category,
    p_description: parsed.data.description || null,
    p_minimum_stock: parsed.data.minimumStock,
    p_supplier: parsed.data.supplier || null,
    p_unit_cost: parsed.data.unitCost,
  });
  if (error || typeof data !== "string") return productFormError(posErrorCode(error?.message ?? ""), productId || null);

  const { data: existing } = await supabase.from("products").select("image_path").eq("id", data).maybeSingle();
  const previousPath = (existing?.image_path as string | null) ?? null;
  if (image.image) {
    const path = await uploadProductImage(supabase, data, image.image);
    if (!path) return productFormError("image-path", data);
    const { error: imageError } = await supabase.rpc("set_product_image", {
      p_product_id: data,
      p_image_path: path,
    });
    if (imageError) {
      await removeProductImage(supabase, path);
      return productFormError(posErrorCode(imageError.message ?? ""), data);
    }
    if (previousPath && previousPath !== path) await removeProductImage(supabase, previousPath);
  } else if (image.remove && previousPath) {
    const { error: imageError } = await supabase.rpc("set_product_image", {
      p_product_id: data,
      p_image_path: null,
    });
    if (imageError) return productFormError(posErrorCode(imageError.message ?? ""), data);
    await removeProductImage(supabase, previousPath);
  }

  if (opening?.quantity) {
    const { error: stockError } = await supabase.rpc("record_inventory_movement", {
      p_product_id: data,
      p_movement_type: "STOCK_IN",
      p_quantity: opening.quantity,
      p_reason: "Initial stock",
      p_batch_id: null,
      p_supplier: parsed.data.supplier || null,
      p_reference_note: null,
      p_unit_cost: parsed.data.unitCost,
      p_expiration_date: opening.expiration,
      p_direction: "IN",
    });
    if (stockError) return productFormError(posErrorCode(stockError.message ?? ""), data);
  }

  if (batchDates.updates.length > 0) {
    const { data: owned } = await supabase.from("product_batches").select("id, expiration_date").eq("product_id", data);
    const currentDates = new Map(
      ((owned ?? []) as { id: string; expiration_date: string | null }[]).map((batch) => [
        batch.id,
        batch.expiration_date?.slice(0, 10) ?? null,
      ]),
    );
    for (const update of batchDates.updates) {
      if (!currentDates.has(update.id)) return productFormError("expiration-date", data);
      if (currentDates.get(update.id) === update.expiration) continue;
      const { error: expirationError } = await supabase.rpc("set_batch_expiration", {
        p_batch_id: update.id,
        p_expiration: update.expiration,
      });
      if (expirationError) return productFormError("expiration-date", data);
    }
  }

  refreshPos();
  return { productId: data, productName: parsed.data.name, pendingProductId: null, error: null };
}

export async function saveProductForm(
  _previous: ProductFormState,
  formData: FormData,
): Promise<ProductFormState> {
  return performProductSave(formData);
}

export async function upsertProductAction(formData: FormData): Promise<void> {
  const result = await performProductSave(formData);
  if (!result.productId) redirect(withCode("/staff/inventory", "error", result.error ?? "generic"));
  redirect(withCode("/staff/inventory", "notice", "saved"));
}

export async function adjustStockAction(formData: FormData): Promise<void> {
  await requireRole(["STAFF", "SENIOR_VET"]);
  const productId = String(formData.get("productId") ?? "");
  const parsed = stockAdjustmentSchema.safeParse({
    productId,
    delta: String(formData.get("delta") ?? ""),
    reason: String(formData.get("reason") ?? ""),
  });
  if (!parsed.success) {
    const fields = z.flattenError(parsed.error).fieldErrors;
    redirect(withCode(`/staff/inventory/${productId}`, "error", fields.reason ? "adjust-reason" : "bad-quantity"));
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("adjust_product_stock", {
    p_product_id: parsed.data.productId,
    p_delta: parsed.data.delta,
    p_reason: parsed.data.reason,
  });
  if (error) fail(`/staff/inventory/${parsed.data.productId}`, error);
  refreshPos();
  redirect(withCode(`/staff/inventory/${parsed.data.productId}`, "notice", "adjusted"));
}

export async function signProductImagesAction(paths: string[]): Promise<Record<string, string>> {
  await requireRole(["STAFF", "SENIOR_VET"]);
  const safe = paths.filter((path) => /^[0-9a-f-]{36}\/[0-9a-f-]{36}\.(jpg|png|webp)$/i.test(path));
  const supabase = await createClient();
  return getProductImageUrls(supabase, safe);
}

export async function clearUnusedImagePath(productId: string, path: string) {
  if (!isUuid(productId) || !isProductImagePath(productId, path)) return;
  const supabase = await createClient();
  await removeProductImage(supabase, path);
}
