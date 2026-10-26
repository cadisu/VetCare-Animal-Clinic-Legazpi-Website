const INVENTORY_ERROR_PHRASES: Record<string, string> = {
  "Enter a reason for this stock change": "movement-reason",
  "This batch is not expired": "batch-not-expired",
  "Choose a batch": "choose-batch",
  "Enter a valid warning period": "warning-days",
  "Enter a valid cost": "unit-cost",
  "Supplier name is too long": "supplier",
  "Reference is too long": "reference",
  "Choose a stock movement": "movement-type",
  "Choose whether to add or remove stock": "movement-direction",
  "Stock is out of balance": "stock-balance",
  "Not enough stock": "no-stock",
  "Enter a valid quantity": "bad-quantity",
  "This product is not available": "product-unavailable",
  "Not authorized": "not-authorized",
};

const INVENTORY_ERROR_TEXT: Record<string, string> = {
  "movement-reason": "Enter a reason of at least 3 characters.",
  "batch-not-expired": "Expired can only be recorded for a batch whose date is already past.",
  "choose-batch": "Choose the batch this change applies to.",
  "warning-days": "Enter a warning period from 1 to 365 days.",
  "unit-cost": "Enter a valid unit cost, or leave it blank.",
  supplier: "Enter a shorter supplier name.",
  reference: "Enter a shorter reference.",
  "movement-type": "Choose a stock movement.",
  "movement-direction": "Choose whether the adjustment adds or removes stock.",
  "stock-balance": "The stock totals did not match. Nothing was saved.",
  "no-stock": "That batch does not have enough quantity.",
  "bad-quantity": "Enter a whole quantity of at least 1.",
  "product-unavailable": "That product is not available.",
  "not-authorized": "You are not allowed to do that.",
  "expiration-date": "Enter a valid expiration date, or leave it blank.",
  generic: "Something went wrong. Please try again.",
};

const INVENTORY_NOTICE_TEXT: Record<string, string> = {
  recorded: "Stock movement recorded.",
  warning: "Expiration warning updated.",
};

export function inventoryErrorCode(message: string): string {
  const phrase = Object.keys(INVENTORY_ERROR_PHRASES).find((item) => message.includes(item));
  return phrase ? INVENTORY_ERROR_PHRASES[phrase] : "generic";
}

export function inventoryErrorText(code: string | undefined): string | null {
  if (!code) return null;
  return INVENTORY_ERROR_TEXT[code] ?? null;
}

export function inventoryNoticeText(code: string | undefined): string | null {
  if (!code) return null;
  return INVENTORY_NOTICE_TEXT[code] ?? null;
}
