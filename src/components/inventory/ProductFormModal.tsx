"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { saveProductForm, type ProductFormState } from "@/app/actions/pos";
import { ProductImageField } from "@/components/pos/ProductImageField";
import { PosSubmitButton } from "@/components/pos/PosSubmitButton";
import { Dialog } from "@/components/ui/Dialog";
import { FormField, SelectField, TextAreaField } from "@/components/ui/FormField";
import { posErrorText } from "@/lib/pos/notices";
import { PRODUCT_CATEGORIES, type CatalogProduct } from "@/lib/pos/types";

const initialState: ProductFormState = { productId: null, productName: null, pendingProductId: null, error: null };

export function ProductFormModal({
  open,
  product,
  imageUrl,
  batches = [],
  onClose,
  onCreated,
  onSaved,
}: {
  open: boolean;
  product: CatalogProduct | null;
  imageUrl: string | null;
  batches?: { id: string; label: string; expirationDate: string | null }[];
  onClose: () => void;
  onCreated: (productId: string, productName: string) => void;
  onSaved: () => void;
}) {
  const [state, action] = useActionState(saveProductForm, initialState);
  const [unavailable, setUnavailable] = useState(product ? !product.is_active : false);
  const reported = useRef<string | null>(null);

  useEffect(() => {
    if (!state.productId || reported.current === state.productId) return;
    reported.current = state.productId;
    if (product) onSaved();
    else onCreated(state.productId, state.productName ?? "this product");
  }, [state.productId, state.productName, product, onCreated, onSaved]);

  const message = posErrorText(state.error ?? undefined);

  return (
    <Dialog open={open} title={product ? "Edit product" : "Add product"} onClose={onClose}>
      <p className="text-sm text-muted">
        {product
          ? "Saving catalog details does not change quantities or movement history. Each receipt date below can be changed or cleared."
          : "Leave quantity and expiration blank when this product has no stock yet. A blank expiration date stays empty."}
      </p>
      {message && <p className="mt-3 text-sm font-medium text-accent">{message}</p>}
      <form action={action} className="mt-4 space-y-4">
        {(product || state.pendingProductId) && (
          <input type="hidden" name="productId" value={product?.id ?? state.pendingProductId ?? ""} />
        )}
        <input type="hidden" name="quantityOnHand" value={String(product?.quantity_on_hand ?? 0)} />
        <input type="hidden" name="isActive" value={unavailable ? "false" : "true"} />
        {!product && <input type="hidden" name="openingReceipt" value="true" />}
        <FormField label="Name" name="name" required maxLength={120} defaultValue={product?.name ?? ""} />
        <SelectField label="Category" name="category" defaultValue={product?.category ?? "General"}>
          {PRODUCT_CATEGORIES.map((category) => (
            <option key={category} value={category}>{category}</option>
          ))}
        </SelectField>
        <FormField label="Unit" name="unit" required maxLength={40} placeholder="piece, bottle, tablet" defaultValue={product?.unit ?? ""} />
        <FormField label="Selling price" name="price" required inputMode="decimal" defaultValue={product ? String(product.price) : ""} />
        <FormField
          label="Purchase cost"
          name="unitCost"
          labelNote="(optional)"
          hint="What the clinic paid for one unit. This is separate from the selling price."
          inputMode="decimal"
          defaultValue={product?.unit_cost === null || product?.unit_cost === undefined ? "" : String(product.unit_cost)}
        />
        <FormField label="Supplier" name="supplier" labelNote="(optional)" maxLength={120} defaultValue={product?.supplier ?? ""} />
        {!product && (
          <>
            <FormField label="Quantity received" name="openingQuantity" labelNote="(optional)" inputMode="numeric" />
            <FormField
              label="Expiration date"
              name="expirationDate"
              type="date"
              labelNote="(optional)"
              hint="This batch’s expiration date. Leave it blank when the receipt has no expiration date."
            />
          </>
        )}
        {product && batches.length > 0 && (
          <fieldset className="space-y-4">
            <legend className="text-sm font-semibold text-ink">Batch expiration</legend>
            {batches.map((batch) => (
              <FormField
                key={batch.id}
                label={batch.label}
                name={`batchExpiration:${batch.id}`}
                type="date"
                labelNote="(optional)"
                defaultValue={batch.expirationDate ?? ""}
                hint="Leave blank when this receipt has no expiration date."
              />
            ))}
          </fieldset>
        )}
        <FormField
          label="Low-stock warning"
          name="minimumStock"
          labelNote="(optional)"
          hint="Show a low-stock alert when this many, or fewer, are left."
          inputMode="numeric"
          defaultValue={product?.minimum_stock === null || product?.minimum_stock === undefined ? "" : String(product.minimum_stock)}
        />
        <TextAreaField label="Description" name="description" labelNote="(optional)" defaultValue={product?.description ?? ""} />
        {product && (
          <label className="block text-sm text-ink">
            <span className="flex items-center gap-2 font-medium">
              <input
                type="checkbox"
                checked={unavailable}
                onChange={(event) => setUnavailable(event.target.checked)}
              />
              No longer available
            </span>
            <span className="mt-1 block text-muted">
              The product stays in Inventory and in movement history. POS will not sell it. Leftover units stay on hand until a stock movement removes them.
            </span>
          </label>
        )}
        <ProductImageField currentUrl={imageUrl} />
        <div className="flex flex-wrap gap-3">
          <PosSubmitButton pendingText="Saving...">Save product</PosSubmitButton>
          <button type="button" onClick={onClose} className="min-h-11 px-3 text-sm font-semibold text-muted">
            Cancel
          </button>
        </div>
      </form>
    </Dialog>
  );
}
