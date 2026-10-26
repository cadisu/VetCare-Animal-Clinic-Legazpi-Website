import type { PosStatus } from "@/lib/pos/status";

export const PRODUCT_CATEGORIES = ["General", "Medicine", "Food", "Supply", "Grooming", "Other"] as const;

export type PosItemType = "SERVICE" | "PRODUCT";

export type PosItem = {
  id: string;
  transaction_id: string;
  item_type: PosItemType;
  service_id: string | null;
  product_id: string | null;
  appointment_id: string | null;
  pet_id: string | null;
  description: string;
  quantity: number;
  unit_price: number | string;
  subtotal: number | string;
};

export type PosBill = {
  id: string;
  reference: string;
  client_id: string | null;
  pet_id: string | null;
  appointment_id: string | null;
  status: PosStatus;
  subtotal: number | string;
  discount_amount: number | string;
  reward_amount: number | string;
  total: number | string;
  amount_paid: number | string | null;
  amount_tendered: number | string | null;
  change_amount: number | string | null;
  walk_in_name: string | null;
  walk_in_contact: string | null;
  created_at: string;
  completed_at: string | null;
  voided_at: string | null;
  void_reason: string | null;
  client_name: string;
  pet_name: string | null;
  processor_name: string | null;
  voided_by_name: string | null;
  items: PosItem[];
};

export type PosListRow = {
  id: string;
  reference: string;
  status: PosStatus;
  total: number | string;
  amount_paid: number | string | null;
  amount_tendered: number | string | null;
  change_amount: number | string | null;
  created_at: string;
  completed_at: string | null;
  client_name: string;
  pet_name: string | null;
};

export type PosEdit = {
  id: string;
  reason: string;
  created_at: string;
  editor_name: string | null;
  previous_total: number | string;
};

export type SellableService = {
  id: string;
  name: string;
  category: string;
  price: number | string;
  requires_veterinarian: boolean;
};

export type SellableProduct = {
  id: string;
  name: string;
  category: string;
  description: string | null;
  unit: string;
  price: number | string;
  quantity_on_hand: number;
  minimum_stock: number | null;
  supplier: string | null;
  unit_cost: number | string | null;
  sellable_quantity: number;
  image_path: string | null;
  is_active: boolean;
};

export type CatalogProduct = SellableProduct & {
  has_sales: boolean;
};
