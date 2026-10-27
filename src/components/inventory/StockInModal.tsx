"use client";

import { useActionState, useEffect, useRef } from "react";
import { saveStockInForm, type StockInFormState } from "@/app/actions/inventory";
import { PosSubmitButton } from "@/components/pos/PosSubmitButton";
import { Dialog } from "@/components/ui/Dialog";
import { FormField, TextAreaField } from "@/components/ui/FormField";
import { inventoryErrorText } from "@/lib/inventory/notices";

const initialState: StockInFormState = { saved: false, error: null };

export function StockInModal({
  open,
  productId,
  productName,
  title,
  onClose,
  onSaved,
}: {
  open: boolean;
  productId: string;
  productName: string;
  title: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [state, action] = useActionState(saveStockInForm, initialState);
  const reported = useRef(false);

  useEffect(() => {
    if (!state.saved || reported.current) return;
    reported.current = true;
    onSaved();
  }, [state.saved, onSaved]);

  const message = inventoryErrorText(state.error ?? undefined);

  return (
    <Dialog open={open} title={title} onClose={onClose}>
      <p className="text-sm text-muted">
        Receive stock for {productName}. Leave the expiration date blank when this receipt has no expiration date. The expiry warning period does not choose this date.
      </p>
      {message && <p className="mt-3 text-sm font-medium text-accent">{message}</p>}
      <form action={action} className="mt-4 space-y-4">
        <input type="hidden" name="productId" value={productId} />
        <FormField label="Quantity received" name="quantity" required inputMode="numeric" />
        <FormField label="Expiration date" name="expirationDate" type="date" labelNote="(optional)" />
        <FormField label="Supplier for this receipt" name="supplier" labelNote="(optional)" maxLength={120} />
        <FormField label="Unit cost for this receipt" name="unitCost" labelNote="(optional)" inputMode="decimal" />
        <FormField label="Reference" name="referenceNote" labelNote="(optional)" maxLength={80} placeholder="Delivery note or invoice" />
        <TextAreaField label="Reason" name="reason" required placeholder="Opening receipt or delivery received" />
        <div className="flex flex-wrap gap-3">
          <PosSubmitButton pendingText="Saving...">Save stock</PosSubmitButton>
          <button type="button" onClick={onClose} className="min-h-11 px-3 text-sm font-semibold text-muted">
            {title === "Add initial stock" ? "Skip for now" : "Cancel"}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
