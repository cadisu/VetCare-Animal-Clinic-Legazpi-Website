import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { todayIso } from "@/lib/dates";
import {
  batchExpiryStatus,
  isMovementType,
  mostUrgentExpiry,
  sellableQuantity,
  stockLevel,
  type ExpiryStatus,
  type MovementType,
} from "@/lib/inventory/status";

export type InventoryBatch = {
  id: string;
  product_id: string;
  quantity_remaining: number;
  expiration_date: string | null;
  supplier: string | null;
  unit_cost: number | string | null;
  received_at: string;
  expiry_status: ExpiryStatus;
};

export type InventoryMovement = {
  id: string;
  product_id: string;
  product_name: string;
  unit: string;
  movement_type: MovementType;
  quantity_delta: number;
  reason: string | null;
  supplier: string | null;
  reference_note: string | null;
  unit_cost: number | string | null;
  created_at: string;
  actor_name: string | null;
  batch_label: string;
};

export type InventoryAlerts = {
  warningDays: number;
  out: { id: string; name: string }[];
  low: { id: string; name: string }[];
  expiringSoon: { productId: string; productName: string; expirationDate: string; quantity: number }[];
  expired: { productId: string; productName: string; expirationDate: string; quantity: number }[];
};

type BatchRecord = {
  id: string;
  product_id: string;
  quantity_remaining: number;
  expiration_date: string | null;
  supplier: string | null;
  unit_cost: number | string | null;
  received_at: string;
};

function cleanSearch(value: string): string {
  return value.replace(/[,()%*\\"]/g, " ").replace(/\s+/g, " ").trim().slice(0, 60);
}

export async function getWarningDays(supabase: SupabaseClient): Promise<number> {
  const { data } = await supabase.from("clinic_settings").select("expiry_warning_days").eq("id", 1).maybeSingle();
  const days = data?.expiry_warning_days;
  return typeof days === "number" && days >= 1 && days <= 365 ? days : 30;
}

export async function listBatches(supabase: SupabaseClient, productId?: string): Promise<InventoryBatch[]> {
  const today = todayIso();
  const warningDays = await getWarningDays(supabase);
  let request = supabase
    .from("product_batches")
    .select("id, product_id, quantity_remaining, expiration_date, supplier, unit_cost, received_at")
    .order("received_at", { ascending: true });
  if (productId) request = request.eq("product_id", productId);
  const { data } = await request;
  return ((data ?? []) as BatchRecord[])
    .map((batch) => ({
      ...batch,
      expiry_status: batchExpiryStatus(batch.expiration_date, today, warningDays),
    }))
    .sort((a, b) => {
      if (a.expiration_date === b.expiration_date) return a.received_at.localeCompare(b.received_at);
      if (!a.expiration_date) return 1;
      if (!b.expiration_date) return -1;
      return a.expiration_date.localeCompare(b.expiration_date);
    });
}

export function stockFacts(
  quantityOnHand: number,
  minimumStock: number | null,
  batches: InventoryBatch[],
  today: string,
) {
  const active = batches.filter((batch) => batch.quantity_remaining > 0);
  const statuses = active.map((batch) => batch.expiry_status);
  return {
    level: stockLevel(quantityOnHand, minimumStock),
    sellable: sellableQuantity(
      active.map((batch) => ({
        quantityRemaining: batch.quantity_remaining,
        expirationDate: batch.expiration_date,
      })),
      today,
    ),
    expiryStatus: mostUrgentExpiry(statuses),
    hasExpired: statuses.includes("EXPIRED"),
    hasExpiringSoon: statuses.includes("EXPIRING_SOON"),
  };
}

export async function listInventoryAlerts(supabase: SupabaseClient): Promise<InventoryAlerts> {
  const today = todayIso();
  const [warningDays, batchesResult, productsResult] = await Promise.all([
    getWarningDays(supabase),
    supabase
      .from("product_batches")
      .select("id, product_id, quantity_remaining, expiration_date, supplier, unit_cost, received_at"),
    supabase.from("products").select("id, name, quantity_on_hand, minimum_stock, is_active"),
  ]);
  const batches = ((batchesResult.data ?? []) as BatchRecord[]).map((batch) => ({
    ...batch,
    expiry_status: batchExpiryStatus(batch.expiration_date, today, warningDays),
  }));
  const products = (productsResult.data ?? []) as {
    id: string;
    name: string;
    quantity_on_hand: number;
    minimum_stock: number | null;
    is_active: boolean;
  }[];
  const names = new Map(products.map((product) => [product.id, product.name]));
  const active = products.filter((product) => product.is_active);
  const expiringSoon = batches
    .filter((batch) => batch.quantity_remaining > 0 && batch.expiry_status === "EXPIRING_SOON" && names.has(batch.product_id))
    .filter((batch) => active.some((product) => product.id === batch.product_id))
    .map((batch) => ({
      productId: batch.product_id,
      productName: names.get(batch.product_id) ?? "Product",
      expirationDate: batch.expiration_date ?? "",
      quantity: batch.quantity_remaining,
    }));
  const expired = batches
    .filter((batch) => batch.quantity_remaining > 0 && batch.expiry_status === "EXPIRED" && batch.expiration_date)
    .filter((batch) => active.some((product) => product.id === batch.product_id))
    .map((batch) => ({
      productId: batch.product_id,
      productName: names.get(batch.product_id) ?? "Product",
      expirationDate: batch.expiration_date ?? "",
      quantity: batch.quantity_remaining,
    }));
  return {
    warningDays,
    out: active
      .filter((product) => stockLevel(product.quantity_on_hand, product.minimum_stock) === "OUT")
      .map((product) => ({ id: product.id, name: product.name })),
    low: active
      .filter((product) => stockLevel(product.quantity_on_hand, product.minimum_stock) === "LOW")
      .map((product) => ({ id: product.id, name: product.name })),
    expiringSoon,
    expired,
  };
}

function batchText(batch: Pick<InventoryBatch, "expiration_date" | "received_at"> | undefined): string {
  if (!batch) return "Batch";
  const received = batch.received_at.slice(0, 10);
  return batch.expiration_date ? `Expires ${batch.expiration_date} · received ${received}` : `No expiration · received ${received}`;
}

export async function listInventoryMovements(
  supabase: SupabaseClient,
  filters: { productId?: string; movementType?: string; from?: string; to?: string; query?: string },
): Promise<InventoryMovement[]> {
  let request = supabase
    .from("product_stock_movements")
    .select(
      "id, product_id, movement_type, quantity_delta, reason, supplier, reference_note, unit_cost, batch_id, created_at, created_by",
    )
    .order("created_at", { ascending: false })
    .limit(200);
  if (filters.productId) request = request.eq("product_id", filters.productId);
  if (filters.movementType && isMovementType(filters.movementType)) {
    request = request.eq("movement_type", filters.movementType);
  }
  if (filters.from) request = request.gte("created_at", `${filters.from}T00:00:00+08:00`);
  if (filters.to) request = request.lte("created_at", `${filters.to}T23:59:59+08:00`);
  const query = cleanSearch(filters.query ?? "");
  if (query) {
    const pattern = `%${query}%`;
    const { data: matched } = await supabase.from("products").select("id").ilike("name", pattern).limit(40);
    const ids = (matched ?? []).map((row) => row.id as string);
    const parts = [`reason.ilike."${pattern}"`, `supplier.ilike."${pattern}"`, `reference_note.ilike."${pattern}"`];
    if (ids.length > 0) parts.push(`product_id.in.(${ids.join(",")})`);
    request = request.or(parts.join(","));
  }
  const { data } = await request;
  const rows = (data ?? []) as {
    id: string;
    product_id: string;
    movement_type: string;
    quantity_delta: number;
    reason: string | null;
    supplier: string | null;
    reference_note: string | null;
    unit_cost: number | string | null;
    batch_id: string | null;
    created_at: string;
    created_by: string;
  }[];
  const productIds = [...new Set(rows.map((row) => row.product_id))];
  const actorIds = [...new Set(rows.map((row) => row.created_by))];
  const movementIds = rows.map((row) => row.id);
  const [{ data: products }, { data: actors }, { data: allocations }] = await Promise.all([
    productIds.length
      ? supabase.from("products").select("id, name, unit").in("id", productIds)
      : Promise.resolve({ data: [] }),
    actorIds.length
      ? supabase.from("profiles").select("id, full_name").in("id", actorIds)
      : Promise.resolve({ data: [] }),
    movementIds.length
      ? supabase.from("product_batch_allocations").select("movement_id, batch_id, quantity, direction").in("movement_id", movementIds)
      : Promise.resolve({ data: [] }),
  ]);
  const productName = new Map(
    ((products ?? []) as { id: string; name: string; unit: string }[]).map((product) => [product.id, product]),
  );
  const actorName = new Map(
    ((actors ?? []) as { id: string; full_name: string | null }[]).map((actor) => [actor.id, actor.full_name]),
  );
  const allocationRows = (allocations ?? []) as {
    movement_id: string;
    batch_id: string;
    quantity: number;
    direction: string;
  }[];
  const batchIds = [
    ...new Set([
      ...rows.map((row) => row.batch_id).filter((id): id is string => Boolean(id)),
      ...allocationRows.map((row) => row.batch_id),
    ]),
  ];
  const { data: batchRows } = batchIds.length
    ? await supabase.from("product_batches").select("id, expiration_date, received_at").in("id", batchIds)
    : { data: [] };
  const batches = new Map(
    ((batchRows ?? []) as { id: string; expiration_date: string | null; received_at: string }[]).map((batch) => [
      batch.id,
      batch,
    ]),
  );
  const allocationsByMovement = new Map<string, typeof allocationRows>();
  for (const allocation of allocationRows) {
    const list = allocationsByMovement.get(allocation.movement_id) ?? [];
    list.push(allocation);
    allocationsByMovement.set(allocation.movement_id, list);
  }

  return rows.flatMap((row) => {
    if (!isMovementType(row.movement_type)) return [];
    const product = productName.get(row.product_id);
    const direct = row.batch_id ? batches.get(row.batch_id) : undefined;
    const allocated = allocationsByMovement.get(row.id) ?? [];
    const labels = direct
      ? [batchText(direct)]
      : allocated.map((allocation) => {
          const text = batchText(batches.get(allocation.batch_id));
          return `${text} (${allocation.direction === "OUT" ? "−" : "+"}${allocation.quantity})`;
        });
    return [
      {
        id: row.id,
        product_id: row.product_id,
        product_name: product?.name ?? "Product",
        unit: product?.unit ?? "",
        movement_type: row.movement_type,
        quantity_delta: row.quantity_delta,
        reason: row.reason,
        supplier: row.supplier,
        reference_note: row.reference_note,
        unit_cost: row.unit_cost,
        created_at: row.created_at,
        actor_name: actorName.get(row.created_by) ?? null,
        batch_label: labels.length > 0 ? labels.join("; ") : "—",
      },
    ];
  });
}
