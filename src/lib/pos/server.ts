import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isUuid } from "@/lib/pets/constants";
import { isPosStatus, type PosStatus } from "@/lib/pos/status";
import type { CatalogProduct, PosBill, PosEdit, PosItem, PosListRow, SellableProduct, SellableService } from "@/lib/pos/types";

type NameRow = { id: string; full_name?: string; name?: string };

function asItems(value: unknown): PosItem[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is PosItem => Boolean(item && typeof item === "object"));
}

async function namesById(
  supabase: SupabaseClient,
  table: "profiles" | "pets",
  ids: string[],
  label: "full_name" | "name",
): Promise<Map<string, string>> {
  const unique = [...new Set(ids.filter(Boolean))];
  const map = new Map<string, string>();
  if (unique.length === 0) return map;
  const { data } = await supabase.from(table).select(`id, ${label}`).in("id", unique);
  for (const row of (data ?? []) as NameRow[]) {
    const value = label === "full_name" ? row.full_name : row.name;
    if (value) map.set(row.id, value);
  }
  return map;
}

function toListRow(
  row: {
    id: string;
    reference: string;
    status: string;
    total: number | string;
    amount_paid: number | string | null;
    amount_tendered?: number | string | null;
    change_amount?: number | string | null;
    created_at: string;
    completed_at: string | null;
    client_id: string | null;
    pet_id: string | null;
    walk_in_name?: string | null;
  },
  clients: Map<string, string>,
  pets: Map<string, string>,
): PosListRow | null {
  if (!isPosStatus(row.status)) return null;
  return {
    id: row.id,
    reference: row.reference,
    status: row.status,
    total: row.total,
    amount_paid: row.amount_paid,
    amount_tendered: row.amount_tendered ?? null,
    change_amount: row.change_amount ?? null,
    created_at: row.created_at,
    completed_at: row.completed_at,
    client_name: row.walk_in_name || (row.client_id ? clients.get(row.client_id) ?? "Client" : "Walk-in"),
    pet_name: row.pet_id ? pets.get(row.pet_id) ?? null : null,
  };
}

export async function getPosBill(supabase: SupabaseClient, id: string): Promise<PosBill | null> {
  if (!isUuid(id)) return null;
  const { data, error } = await supabase.from("pos_transactions").select("*").eq("id", id).maybeSingle();
  if (error || !data || !isPosStatus(data.status)) return null;

  const [{ data: itemRows }, clients, pets] = await Promise.all([
    supabase
      .from("pos_transaction_items")
      .select("*")
      .eq("transaction_id", id)
      .order("created_at", { ascending: true }),
    namesById(
      supabase,
      "profiles",
      [data.client_id, data.processed_by, data.voided_by].filter(Boolean),
      "full_name",
    ),
    namesById(supabase, "pets", data.pet_id ? [data.pet_id] : [], "name"),
  ]);

  return {
    id: data.id,
    reference: data.reference,
    client_id: data.client_id,
    pet_id: data.pet_id,
    appointment_id: data.appointment_id,
    status: data.status,
    subtotal: data.subtotal,
    discount_amount: data.discount_amount,
    reward_amount: data.reward_amount,
    total: data.total,
    amount_paid: data.amount_paid,
    amount_tendered: data.amount_tendered ?? null,
    change_amount: data.change_amount ?? null,
    walk_in_name: data.walk_in_name ?? null,
    walk_in_contact: data.walk_in_contact ?? null,
    created_at: data.created_at,
    completed_at: data.completed_at,
    voided_at: data.voided_at,
    void_reason: data.void_reason,
    client_name: data.walk_in_name || (data.client_id ? clients.get(data.client_id) ?? "Client" : "Walk-in"),
    pet_name: data.pet_id ? pets.get(data.pet_id) ?? null : null,
    processor_name: data.processed_by ? clients.get(data.processed_by) ?? null : null,
    voided_by_name: data.voided_by ? clients.get(data.voided_by) ?? null : null,
    items: asItems(itemRows),
  };
}

export async function listPosTransactions(
  supabase: SupabaseClient,
  statuses: readonly PosStatus[],
  options: { limit?: number; query?: string; from?: string; to?: string } = {},
): Promise<PosListRow[]> {
  const limit = options.limit ?? 50;
  let request = supabase
    .from("pos_transactions")
    .select(
      "id, reference, status, total, amount_paid, amount_tendered, change_amount, created_at, completed_at, client_id, pet_id, walk_in_name",
    )
    .in("status", [...statuses])
    .order("created_at", { ascending: false })
    .limit(limit);

  if (options.from) request = request.gte("created_at", `${options.from}T00:00:00+08:00`);
  if (options.to) request = request.lte("created_at", `${options.to}T23:59:59+08:00`);

  const query = (options.query ?? "").replace(/[,()%*\\"]/g, " ").replace(/\s+/g, " ").trim().slice(0, 60);
  if (query) {
    const pattern = `%${query}%`;
    const { data: matchedClients } = await supabase
      .from("profiles")
      .select("id")
      .eq("role", "CLIENT")
      .or(`full_name.ilike."${pattern}",contact_number.ilike."${pattern}"`)
      .limit(30);
    const clientIds = (matchedClients ?? []).map((row) => row.id as string);
    const filters = [`reference.ilike."${pattern}"`, `walk_in_name.ilike."${pattern}"`];
    if (clientIds.length) filters.push(`client_id.in.(${clientIds.join(",")})`);
    request = request.or(filters.join(","));
  }

  const { data } = await request;
  const rows = data ?? [];
  const [clients, pets] = await Promise.all([
    namesById(supabase, "profiles", rows.map((row) => row.client_id).filter(Boolean), "full_name"),
    namesById(supabase, "pets", rows.map((row) => row.pet_id).filter(Boolean), "name"),
  ]);
  return rows
    .map((row) => toListRow(row, clients, pets))
    .filter((row): row is PosListRow => row !== null);
}

export async function listVisitBills(
  supabase: SupabaseClient,
  appointmentId: string,
): Promise<{ id: string; status: PosStatus }[]> {
  const { data } = await supabase
    .from("pos_transactions")
    .select("id, status, created_at")
    .eq("appointment_id", appointmentId)
    .order("created_at", { ascending: false });
  return (data ?? []).flatMap((row) => (isPosStatus(row.status) ? [{ id: row.id, status: row.status }] : []));
}

export async function listBilledServiceIds(
  supabase: SupabaseClient,
  appointmentId: string,
  exceptTransactionId?: string,
): Promise<string[]> {
  let billsQuery = supabase
    .from("pos_transactions")
    .select("id")
    .eq("appointment_id", appointmentId)
    .neq("status", "VOIDED");
  if (exceptTransactionId) billsQuery = billsQuery.neq("id", exceptTransactionId);
  const { data: bills } = await billsQuery;
  const ids = (bills ?? []).map((bill) => bill.id as string);
  if (ids.length === 0) return [];
  const { data: items } = await supabase
    .from("pos_transaction_items")
    .select("service_id")
    .in("transaction_id", ids)
    .eq("item_type", "SERVICE");
  return [...new Set((items ?? []).map((item) => item.service_id).filter(Boolean))] as string[];
}

export async function listSellableServices(supabase: SupabaseClient): Promise<SellableService[]> {
  const { data } = await supabase
    .from("services")
    .select("id, name, category, price, requires_veterinarian")
    .eq("is_active", true)
    .not("price", "is", null)
    .order("sort_order", { ascending: true });
  return (data ?? []) as SellableService[];
}

export async function listSellableProducts(supabase: SupabaseClient): Promise<SellableProduct[]> {
  const { data } = await supabase
    .from("products")
    .select("id, name, category, description, unit, price, quantity_on_hand, minimum_stock, image_path, is_active")
    .eq("is_active", true)
    .order("name", { ascending: true });
  return (data ?? []) as SellableProduct[];
}

export async function listCatalogProducts(supabase: SupabaseClient): Promise<CatalogProduct[]> {
  const [{ data: products }, { data: movements }] = await Promise.all([
    supabase
      .from("products")
      .select("id, name, category, description, unit, price, quantity_on_hand, minimum_stock, image_path, is_active")
      .order("name", { ascending: true }),
    supabase.from("product_stock_movements").select("product_id"),
  ]);
  const sold = new Set((movements ?? []).map((row) => row.product_id as string));
  return ((products ?? []) as SellableProduct[]).map((product) => ({
    ...product,
    has_sales: sold.has(product.id),
  }));
}

export async function appointmentServicePrice(
  supabase: SupabaseClient,
  appointmentId: string,
): Promise<{ id: string; name: string; price: number | string | null } | null> {
  const { data } = await supabase
    .from("appointments")
    .select("service:services!appointments_service_id_fkey ( id, name, price )")
    .eq("id", appointmentId)
    .maybeSingle();
  const service = data?.service;
  const row = Array.isArray(service) ? service[0] : service;
  if (!row || typeof row !== "object" || !("id" in row)) return null;
  return row as { id: string; name: string; price: number | string | null };
}

export async function listPosEdits(supabase: SupabaseClient, transactionId: string): Promise<PosEdit[]> {
  const { data } = await supabase
    .from("pos_transaction_edits")
    .select("id, reason, created_at, previous_total, edited_by")
    .eq("transaction_id", transactionId)
    .order("created_at", { ascending: false });
  const rows = data ?? [];
  const editors = await namesById(
    supabase,
    "profiles",
    rows.map((row) => row.edited_by as string),
    "full_name",
  );
  return rows.map((row) => ({
    id: row.id as string,
    reason: row.reason as string,
    created_at: row.created_at as string,
    previous_total: row.previous_total as number | string,
    editor_name: editors.get(row.edited_by as string) ?? null,
  }));
}
