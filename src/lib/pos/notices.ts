const POS_ERROR_PHRASES: Record<string, string> = {
  "Only Senior Vets can edit a completed transaction": "senior-edit",
  "Only Senior Vets can void a completed transaction": "senior-void",
  "This edit would change the amount paid": "edit-total",
  "Amount received is less than the amount due": "short-payment",
  "Enter the customer name": "walk-in-name",
  "A walk-in sale cannot be linked to a registered pet": "walk-in-pet",
  "Pet does not match this visit": "pet-visit",
  "Enter a category": "product-category",
  "Enter a reason for the adjustment": "adjust-reason",
  "Enter a reason for the edit": "edit-reason",
  "Image path is not valid": "image-path",
  "Description is too long": "product-description",
  "Enter a valid contact": "walk-in-contact",
  "Enter a valid minimum stock": "min-stock",
  "Enter a valid cost": "unit-cost",
  "Supplier name is too long": "supplier",
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
  "senior-edit": "Only a Senior Vet can edit a completed bill.",
  "senior-product": "Only a Senior Vet can change the product list.",
  "edit-total": "That edit would change the amount already paid. Void the bill and start a new sale instead.",
  "short-payment": "The amount received must cover the full amount due.",
  "walk-in-name": "Enter a customer name, or choose an existing client.",
  "walk-in-pet": "A walk-in sale cannot be linked to a registered pet. Choose a client first.",
  "pet-visit": "The pet has to match the visit on this bill.",
  "product-category": "Choose a category.",
  "adjust-reason": "Enter a reason for the stock adjustment.",
  "edit-reason": "Enter a reason for the edit.",
  "image-path": "That image could not be saved.",
  "product-description": "The description is too long.",
  "walk-in-contact": "Enter a shorter contact number.",
  "min-stock": "Enter a valid minimum stock.",
  "unit-cost": "Enter a valid unit cost, or leave it blank.",
  supplier: "Enter a shorter supplier name.",
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
  "opening-quantity": "Enter the quantity received for this expiration date.",
  "expiration-date": "Enter a valid expiration date, or leave it blank.",
  "product-duplicate": "A product with this name already exists.",
  "stock-locked": "Stock on hand changes through a sale, a void, an edit, or a stock adjustment.",
  "no-delete": "Completed bills stay in the history.",
  generic: "Something went wrong. Please try again.",
};

const POS_NOTICE_TEXT: Record<string, string> = {
  paid: "Amount paid recorded. The visit is not marked completed by this step.",
  voided: "The bill was voided and remains in the history.",
  saved: "Product saved.",
  "bill-saved": "Open bill saved. Stock has not changed.",
  adjusted: "Stock adjustment recorded.",
  edited: "The bill was updated. The amount paid is unchanged.",
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
