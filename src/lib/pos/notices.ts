const POS_ERROR_PHRASES: Record<string, string> = {
  "Only Senior Vets can void a completed transaction": "senior-void",
  "Only Senior Vets can manage products": "senior-product",
  "This service is already on a bill for this visit": "duplicate-service",
  "Set a price for this service before adding it": "missing-price",
  "This service must be billed on a visit": "service-needs-visit",
  "This service is not available": "service-unavailable",
  "This product is not available": "product-unavailable",
  "Add at least one item before recording payment": "empty-bill",
  "This visit cannot be billed yet": "visit-not-ready",
  "Choose a pet that belongs to this client": "pet-owner",
  "This bill can no longer be changed": "bill-locked",
  "A product with this name already exists": "product-duplicate",
  "Stock can only change when a bill is completed or voided": "stock-locked",
  "Completed transactions cannot be deleted": "no-delete",
  "Enter a reason for the void": "void-reason",
  "Enter a product name": "product-name",
  "Enter a valid quantity": "bad-quantity",
  "Enter a valid price": "product-price",
  "Enter a unit": "product-unit",
  "Not enough stock": "no-stock",
  "Appointment not found": "appointment-missing",
  "Transaction not found": "transaction-missing",
  "Client not found": "client-missing",
  "Pet not found": "pet-missing",
  "Not authorized": "not-authorized",
};

const POS_ERROR_TEXT: Record<string, string> = {
  "not-authorized": "You are not allowed to do that.",
  "senior-void": "Only a Senior Vet can void a completed bill.",
  "senior-product": "Only a Senior Vet can change the product list.",
  "appointment-missing": "That visit could not be found.",
  "visit-not-ready": "Open the bill after the visit is in consultation, or after it is completed.",
  "client-missing": "Choose an active client.",
  "pet-missing": "That pet could not be found.",
  "pet-owner": "Choose a pet that belongs to this client.",
  "transaction-missing": "That bill could not be found.",
  "bill-locked": "This bill can no longer be changed.",
  "duplicate-service": "That service is already on a bill for this visit.",
  "missing-price": "Set a price for this service before adding it.",
  "service-unavailable": "That service is not available.",
  "service-needs-visit": "A service has to be billed on a visit. Product sales can stand alone.",
  "product-unavailable": "That product is not available.",
  "no-stock": "There is not enough stock for that quantity.",
  "empty-bill": "Add a service or product before recording the amount paid.",
  "void-reason": "Enter a reason of at least 3 characters.",
  "product-name": "Enter a product name.",
  "product-unit": "Enter a unit, such as piece or bottle.",
  "product-price": "Enter a valid price.",
  "bad-quantity": "Enter a whole quantity from 1 to 999.",
  "product-duplicate": "A product with this name already exists.",
  "stock-locked": "Stock on hand changes when a bill is completed or voided.",
  "no-delete": "Completed bills stay in the history.",
  generic: "Something went wrong. Please try again.",
};

const POS_NOTICE_TEXT: Record<string, string> = {
  paid: "Amount paid recorded. The visit is not marked completed by this step.",
  voided: "The bill was voided and remains in the history.",
  saved: "Product saved.",
};

export function posErrorCode(message: string): string {
  const phrase = Object.keys(POS_ERROR_PHRASES).find((item) => message.includes(item));
  return phrase ? POS_ERROR_PHRASES[phrase] : "generic";
}

export function posErrorText(code: string | undefined): string | null {
  if (!code) return null;
  return POS_ERROR_TEXT[code] ?? null;
}

export function posNoticeText(code: string | undefined): string | null {
  if (!code) return null;
  return POS_NOTICE_TEXT[code] ?? null;
}
