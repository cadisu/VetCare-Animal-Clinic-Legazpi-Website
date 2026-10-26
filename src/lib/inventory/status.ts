import { addDaysIso } from "@/lib/dates";

export const STOCK_LEVELS = ["OUT", "LOW", "OK"] as const;
export type StockLevel = (typeof STOCK_LEVELS)[number];

export const EXPIRY_STATUSES = ["NORMAL", "EXPIRING_SOON", "EXPIRED"] as const;
export type ExpiryStatus = (typeof EXPIRY_STATUSES)[number];

export const INVENTORY_MOVEMENT_TYPES = [
  "STOCK_IN",
  "STOCK_OUT",
  "ADJUSTMENT",
  "DAMAGED",
  "MISSING",
  "EXPIRED",
] as const;
export type InventoryMovementType = (typeof INVENTORY_MOVEMENT_TYPES)[number];

export const MOVEMENT_TYPES = [
  ...INVENTORY_MOVEMENT_TYPES,
  "POS_SALE",
  "POS_VOID",
  "POS_EDIT_RESTORE",
] as const;
export type MovementType = (typeof MOVEMENT_TYPES)[number];

export const STOCK_LEVEL_LABELS: Record<StockLevel, string> = {
  OUT: "Out of stock",
  LOW: "Low stock",
  OK: "In stock",
};

export const EXPIRY_LABELS: Record<ExpiryStatus, string> = {
  NORMAL: "Normal",
  EXPIRING_SOON: "Expiring soon",
  EXPIRED: "Expired",
};

export const MOVEMENT_LABELS: Record<MovementType, string> = {
  STOCK_IN: "Stock in",
  STOCK_OUT: "Stock out",
  ADJUSTMENT: "Adjustment",
  DAMAGED: "Damaged",
  MISSING: "Missing",
  EXPIRED: "Expired",
  POS_SALE: "POS sale",
  POS_VOID: "POS void",
  POS_EDIT_RESTORE: "POS edit restore",
};

export function isMovementType(value: string): value is MovementType {
  return (MOVEMENT_TYPES as readonly string[]).includes(value);
}

/** Out of stock is quantity 0. Low stock is still above 0 and at or below the minimum. */
export function stockLevel(quantityOnHand: number, minimumStock: number | null): StockLevel {
  if (quantityOnHand <= 0) return "OUT";
  if (minimumStock !== null && quantityOnHand <= minimumStock) return "LOW";
  return "OK";
}

/** A blank expiration stays normal. A past date is expired. Today through the warning window is expiring soon. */
export function batchExpiryStatus(
  expirationDate: string | null,
  today: string,
  warningDays: number,
): ExpiryStatus {
  if (!expirationDate) return "NORMAL";
  if (expirationDate < today) return "EXPIRED";
  if (expirationDate <= addDaysIso(today, warningDays)) return "EXPIRING_SOON";
  return "NORMAL";
}

const EXPIRY_RANK: Record<ExpiryStatus, number> = {
  NORMAL: 1,
  EXPIRING_SOON: 2,
  EXPIRED: 3,
};

export function mostUrgentExpiry(statuses: ExpiryStatus[]): ExpiryStatus | null {
  if (statuses.length === 0) return null;
  return statuses.reduce((top, status) => (EXPIRY_RANK[status] > EXPIRY_RANK[top] ? status : top));
}

export function sellableQuantity(
  batches: { quantityRemaining: number; expirationDate: string | null }[],
  today: string,
): number {
  return batches.reduce((sum, batch) => {
    if (batch.quantityRemaining <= 0) return sum;
    if (batch.expirationDate && batch.expirationDate < today) return sum;
    return sum + batch.quantityRemaining;
  }, 0);
}
