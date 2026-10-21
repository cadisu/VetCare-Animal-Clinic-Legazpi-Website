import type { PosStatus } from "@/lib/pos/status";

export type PosItemType = "SERVICE" | "PRODUCT";

export type PosItem = {
  id: string;
  transaction_id: string;
  item_type: PosItemType;
  service_id: string | null;
  product_id: string | null;
  appointment_id: string | null;
  description: string;
  quantity: number;
  unit_price: number | string;
  subtotal: number | string;
};

export type PosBill = {
  id: string;
  reference: string;
  client_id: string;
  pet_id: string | null;
  appointment_id: string | null;
  status: PosStatus;
  subtotal: number | string;
  discount_amount: number | string;
  reward_amount: number | string;
  total: number | string;
  amount_paid: number | string | null;
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
  created_at: string;
  completed_at: string | null;
  client_name: string;
  pet_name: string | null;
};

export type SellableService = {
  id: string;
  name: string;
  price: number | string;
};

export type SellableProduct = {
  id: string;
  name: string;
  unit: string;
  price: number | string;
  quantity_on_hand: number;
  is_active: boolean;
};

export type CatalogProduct = SellableProduct & {
  has_sales: boolean;
};
