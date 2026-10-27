import type { SupabaseClient } from "@supabase/supabase-js";

export type ClientReceiptSummary = {
  id: string;
  reference: string;
  status: "COMPLETED" | "VOIDED";
  total: number | string;
  amountPaid: number | string | null;
  rewardAmount: number | string | null;
  rewardLabel: string | null;
  occurredAt: string | null;
  petName: string | null;
};

export type ClientReceiptLine = {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number | string;
  subtotal: number | string;
};

export type ClientReceipt = ClientReceiptSummary & {
  lines: ClientReceiptLine[];
};

type TransactionRow = {
  id: string;
  reference: string;
  status: "COMPLETED" | "VOIDED";
  total: number | string;
  amount_paid: number | string | null;
  reward_amount: number | string | null;
  reward_label: string | null;
  completed_at: string | null;
  voided_at: string | null;
  pet_id: string | null;
};

function occurredAt(row: TransactionRow): string | null {
  return row.status === "VOIDED" ? row.voided_at ?? row.completed_at : row.completed_at;
}

async function petNames(supabase: SupabaseClient, ids: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return new Map();
  const { data } = await supabase.from("pets").select("id, name").in("id", unique);
  return new Map(((data ?? []) as { id: string; name: string }[]).map((pet) => [pet.id, pet.name]));
}

function toSummary(row: TransactionRow, names: Map<string, string>): ClientReceiptSummary {
  return {
    id: row.id,
    reference: row.reference,
    status: row.status,
    total: row.total,
    amountPaid: row.amount_paid,
    rewardAmount: row.reward_amount,
    rewardLabel: row.reward_label,
    occurredAt: occurredAt(row),
    petName: row.pet_id ? names.get(row.pet_id) ?? null : null,
  };
}

export async function listClientReceipts(supabase: SupabaseClient): Promise<ClientReceiptSummary[]> {
  const { data } = await supabase
    .from("pos_transactions")
    .select("id, reference, status, total, amount_paid, reward_amount, reward_label, completed_at, voided_at, pet_id")
    .in("status", ["COMPLETED", "VOIDED"])
    .order("completed_at", { ascending: false });
  const rows = (data ?? []) as TransactionRow[];
  const names = await petNames(
    supabase,
    rows.map((row) => row.pet_id).filter((id): id is string => Boolean(id)),
  );
  return rows.map((row) => toSummary(row, names));
}

export async function getClientReceipt(supabase: SupabaseClient, transactionId: string): Promise<ClientReceipt | null> {
  const [{ data: bill }, { data: items }] = await Promise.all([
    supabase
      .from("pos_transactions")
      .select("id, reference, status, total, amount_paid, reward_amount, reward_label, completed_at, voided_at, pet_id")
      .eq("id", transactionId)
      .maybeSingle(),
    supabase
      .from("pos_transaction_items")
      .select("id, description, quantity, unit_price, subtotal")
      .eq("transaction_id", transactionId)
      .order("created_at", { ascending: true }),
  ]);
  if (!bill) return null;
  const row = bill as TransactionRow;
  const names = await petNames(supabase, row.pet_id ? [row.pet_id] : []);
  return {
    ...toSummary(row, names),
    lines: ((items ?? []) as { id: string; description: string; quantity: number; unit_price: number | string; subtotal: number | string }[]).map(
      (item) => ({
        id: item.id,
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unit_price,
        subtotal: item.subtotal,
      }),
    ),
  };
}
