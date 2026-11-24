"use client";

import { useState } from "react";
import { recordInventoryMovementAction } from "@/app/actions/inventory";
import { PosSubmitButton } from "@/components/pos/PosSubmitButton";
import { FormField, SelectField, TextAreaField } from "@/components/ui/FormField";
import { INVENTORY_MOVEMENT_TYPES, MOVEMENT_LABELS, type ExpiryStatus } from "@/lib/inventory/status";

export function InventoryMovementForm({
  productId,
  batches,
}: {
  productId: string;
  batches: { id: string; label: string; expiryStatus: ExpiryStatus; quantityRemaining: number }[];
}) {
  const [movementType, setMovementType] = useState<(typeof INVENTORY_MOVEMENT_TYPES)[number]>("STOCK_IN");
  const [direction, setDirection] = useState<"IN" | "OUT">("IN");
  const removing = movementType !== "STOCK_IN" && (movementType !== "ADJUSTMENT" || direction === "OUT");
  const stockIn = movementType === "STOCK_IN";
  const choices = removing
    ? batches.filter((batch) => batch.quantityRemaining > 0 && (movementType !== "EXPIRED" || batch.expiryStatus === "EXPIRED"))
    : batches;

  return (
    <form action={recordInventoryMovementAction} className="mt-4 space-y-4">
      <input type="hidden" name="productId" value={productId} />
      <SelectField
        label="Movement"
        name="movementType"
        value={movementType}
        onChange={(event) => setMovementType(event.target.value as (typeof INVENTORY_MOVEMENT_TYPES)[number])}
      >
        {INVENTORY_MOVEMENT_TYPES.map((type) => (
          <option key={type} value={type}>
            {MOVEMENT_LABELS[type]}
          </option>
        ))}
      </SelectField>
      {movementType === "ADJUSTMENT" && (
        <SelectField
          label="Adjustment"
          name="direction"
          value={direction}
          onChange={(event) => setDirection(event.target.value === "OUT" ? "OUT" : "IN")}
        >
          <option value="IN">Add to a batch</option>
          <option value="OUT">Remove from a batch</option>
        </SelectField>
      )}
      <FormField label="Quantity" name="quantity" required inputMode="numeric" />
      {!stockIn && (
        <SelectField label="Batch" name="batchId" required={removing} labelNote={removing ? undefined : "(optional)"}>
          {!removing && <option value="">New batch with no expiration</option>}
          {removing && <option value="">Choose a batch</option>}
          {choices.map((batch) => (
            <option key={batch.id} value={batch.id}>
              {batch.label}
            </option>
          ))}
        </SelectField>
      )}
      {stockIn && (
        <>
          <FormField
            label="Expiration date"
            name="expirationDate"
            type="date"
            labelNote="(optional)"
            hint="Leave this blank when the receipt has no expiration date. The warning period does not fill it in."
          />
          <FormField label="Supplier" name="supplier" labelNote="(optional)" maxLength={120} />
          <FormField label="Reference" name="referenceNote" labelNote="(optional)" maxLength={80} placeholder="Delivery note or invoice" />
          <FormField label="Purchase cost" name="unitCost" labelNote="(optional)" hint="What the clinic paid for one unit." inputMode="decimal" />
        </>
      )}
      <TextAreaField label="Reason" name="reason" required />
      <PosSubmitButton pendingText="Saving...">Record movement</PosSubmitButton>
    </form>
  );
}
