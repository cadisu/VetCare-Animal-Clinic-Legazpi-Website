"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { ProductFormModal } from "@/components/inventory/ProductFormModal";
import { buttonClass } from "@/components/ui/button-styles";
import { ProductIcon } from "@/components/ui/icons";
import { panelClass } from "@/components/ui/panel-styles";
import { EXPIRY_LABELS, STOCK_LEVEL_LABELS, type ExpiryStatus, type StockLevel } from "@/lib/inventory/status";
import { formatPeso } from "@/lib/pos/money";
import type { CatalogProduct } from "@/lib/pos/types";

export type InventoryRow = {
  product: CatalogProduct;
  level: StockLevel;
  sellable: number;
  expiryStatus: ExpiryStatus | null;
};

export function InventoryCatalog({
  rows,
  imageUrls,
  batches,
}: {
  rows: InventoryRow[];
  imageUrls: Record<string, string>;
  batches: { id: string; productId: string; expirationDate: string | null; label: string }[];
}) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<CatalogProduct | null>(null);

  const refresh = useCallback(() => {
    router.refresh();
  }, [router]);

  const closeProduct = useCallback(() => {
    setAdding(false);
    setEditing(null);
  }, []);

  const onCreated = useCallback(() => {
    setAdding(false);
    refresh();
  }, [refresh]);

  const onEdited = useCallback(() => {
    setEditing(null);
    refresh();
  }, [refresh]);

  const draft = editing;
  const imageUrl = draft?.image_path ? imageUrls[draft.image_path] ?? null : null;

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <button type="button" className={buttonClass("primary")} onClick={() => setAdding(true)}>
          Add Product
        </button>
      </div>
      {rows.length === 0 ? (
        <section className="rounded-2xl border border-dashed border-line bg-white p-10 text-center text-sm text-muted">
          No products in this view. Use Add Product to create one.
        </section>
      ) : (
        <section className={panelClass("overflow-x-auto")}>
          <table className="min-w-full divide-y divide-line text-sm">
            <thead className="bg-highlight/50 text-left text-xs font-semibold uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-3">Product</th>
                <th className="px-4 py-3">Price</th>
                <th className="px-4 py-3">On hand</th>
                <th className="px-4 py-3">Sellable</th>
                <th className="px-4 py-3">Stock</th>
                <th className="px-4 py-3">Expiration</th>
                <th className="px-4 py-3"> </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map(({ product, level, sellable, expiryStatus }) => {
                const imageUrl = product.image_path ? imageUrls[product.image_path] : null;
                return (
                <tr key={product.id}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {imageUrl ? (
                        <img src={imageUrl} alt={product.name} className="h-12 w-12 shrink-0 rounded-lg object-cover" />
                      ) : (
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-highlight text-brand">
                          <ProductIcon className="h-6 w-6" aria-hidden />
                        </div>
                      )}
                      <div className="min-w-0">
                        <Link href={`/staff/inventory/${product.id}`} className="font-medium text-ink hover:underline">
                          {product.name}
                        </Link>
                        <span className="mt-0.5 block text-xs text-muted">
                          {product.category} · {product.unit}
                          {product.supplier ? ` · ${product.supplier}` : ""}
                          {product.is_active ? "" : " · Unavailable"}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">{formatPeso(product.price)}</td>
                  <td className="px-4 py-3">{product.quantity_on_hand}</td>
                  <td className="px-4 py-3">{sellable}</td>
                  <td className="px-4 py-3">{STOCK_LEVEL_LABELS[level]}</td>
                  <td className="px-4 py-3">{expiryStatus ? EXPIRY_LABELS[expiryStatus] : "—"}</td>
                  <td className="px-4 py-3 text-right">
                    <button type="button" onClick={() => setEditing(product)} className="font-semibold text-brand hover:underline">
                      Edit
                    </button>
                    <Link href={`/staff/inventory/${product.id}`} className="ml-3 font-semibold text-brand hover:underline">
                      Batches
                    </Link>
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      )}
      {adding && (
        <ProductFormModal
          open
          product={null}
          imageUrl={null}
          onClose={closeProduct}
          onCreated={onCreated}
          onSaved={onEdited}
        />
      )}
      {draft && (
        <ProductFormModal
          key={draft.id}
          open
          product={draft}
          imageUrl={imageUrl}
          batches={batches
            .filter((batch) => batch.productId === draft.id)
            .map((batch) => ({ id: batch.id, label: batch.label, expirationDate: batch.expirationDate }))}
          onClose={closeProduct}
          onCreated={onCreated}
          onSaved={onEdited}
        />
      )}
    </>
  );
}
