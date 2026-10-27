"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { InventoryMovementForm } from "@/components/inventory/InventoryMovementForm";
import { ProductFormModal } from "@/components/inventory/ProductFormModal";
import { StockInModal } from "@/components/inventory/StockInModal";
import { buttonClass } from "@/components/ui/button-styles";
import { Dialog } from "@/components/ui/Dialog";
import type { ExpiryStatus } from "@/lib/inventory/status";
import type { CatalogProduct } from "@/lib/pos/types";

export function ProductDetailBar({
  product,
  imageUrl,
  batches,
}: {
  product: CatalogProduct;
  imageUrl: string | null;
  batches: {
    id: string;
    label: string;
    receiptLabel: string;
    expiryStatus: ExpiryStatus;
    quantityRemaining: number;
    expirationDate: string | null;
  }[];
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [receiving, setReceiving] = useState(false);
  const [recording, setRecording] = useState(false);
  const refresh = useCallback(() => router.refresh(), [router]);

  return (
    <div className="mb-6 flex flex-wrap gap-3">
      <button type="button" className={buttonClass("primary")} onClick={() => setEditing(true)}>
        Edit product
      </button>
      <button type="button" className={buttonClass("outline")} onClick={() => setReceiving(true)}>
        Add stock
      </button>
      <button type="button" className={buttonClass("outline")} onClick={() => setRecording(true)}>
        Record a movement
      </button>
      {editing && (
        <ProductFormModal
          open
          product={product}
          imageUrl={imageUrl}
          batches={batches.map((batch) => ({
            id: batch.id,
            label: batch.receiptLabel,
            expirationDate: batch.expirationDate,
          }))}
          onClose={() => setEditing(false)}
          onCreated={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            refresh();
          }}
        />
      )}
      {receiving && (
        <StockInModal
          open
          productId={product.id}
          productName={product.name}
          title="Add stock"
          onClose={() => setReceiving(false)}
          onSaved={() => {
            setReceiving(false);
            refresh();
          }}
        />
      )}
      {recording && (
        <Dialog open title="Record a movement" onClose={() => setRecording(false)}>
          <p className="text-sm text-muted">
            Stock-in adds a batch. Damaged, missing, expired, and stock-out remove units from the batch you choose. A reason is kept with the movement.
          </p>
          <InventoryMovementForm productId={product.id} batches={batches} />
        </Dialog>
      )}
    </div>
  );
}
