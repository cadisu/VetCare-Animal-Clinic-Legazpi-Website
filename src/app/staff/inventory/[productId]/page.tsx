import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { InventoryNotice } from "@/components/inventory/InventoryNotice";
import { InventorySectionLinks } from "@/components/inventory/InventorySectionLinks";
import { ProductDetailBar } from "@/components/inventory/ProductDetailBar";
import { DashboardHeading } from "@/components/portal/PlaceholderCard";
import { panelClass } from "@/components/ui/panel-styles";
import { requireRole } from "@/lib/auth/session";
import { formatDate } from "@/lib/dates";
import { listBatches } from "@/lib/inventory/server";
import { EXPIRY_LABELS } from "@/lib/inventory/status";
import { formatPeso } from "@/lib/pos/money";
import { getProductImageUrls } from "@/lib/pos/images";
import { listCatalogProducts } from "@/lib/pos/server";
import { isUuid } from "@/lib/pets/constants";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Product batches" };

export default async function InventoryProductPage({
  params,
  searchParams,
}: {
  params: Promise<{ productId: string }>;
  searchParams: Promise<{ notice?: string; error?: string }>;
}) {
  await requireRole(["STAFF", "SENIOR_VET"]);
  const { productId } = await params;
  if (!isUuid(productId)) notFound();
  const query = await searchParams;
  const supabase = await createClient();
  const [products, batches] = await Promise.all([
    listCatalogProducts(supabase),
    listBatches(supabase, productId),
  ]);
  const product = products.find((item) => item.id === productId);
  if (!product) notFound();
  const imageUrls = await getProductImageUrls(supabase, [product.image_path]);
  const expiredQuantity = batches
    .filter((batch) => batch.expiry_status === "EXPIRED")
    .reduce((sum, batch) => sum + batch.quantity_remaining, 0);

  return (
    <>
      <DashboardHeading
        title={product.name}
        subtitle={`${product.category} · ${product.unit}. On hand ${product.quantity_on_hand}, sellable ${product.sellable_quantity}, expired ${expiredQuantity}.`}
      />
      <InventoryNotice notice={query.notice} error={query.error} />
      <InventorySectionLinks current="inventory" />
      <ProductDetailBar
        product={product}
        imageUrl={product.image_path ? imageUrls[product.image_path] ?? null : null}
        batches={batches.map((batch) => ({
          id: batch.id,
          quantityRemaining: batch.quantity_remaining,
          expiryStatus: batch.expiry_status,
          expirationDate: batch.expiration_date,
          label: `${batch.expiration_date ? formatDate(batch.expiration_date) : "No expiration date"} · ${batch.quantity_remaining} left`,
          receiptLabel: `${batch.id.slice(0, 8)} · ${formatDate(batch.received_at.slice(0, 10))}`,
        }))}
      />
      <section className={panelClass("overflow-x-auto")}>
        <h2 className="p-6 pb-0 text-base font-semibold text-ink">Batches</h2>
        {batches.length === 0 ? (
          <p className="p-6 text-sm text-muted">No batches yet. Record a stock-in to receive some.</p>
        ) : (
          <table className="mt-4 min-w-full divide-y divide-line text-sm">
              <thead className="bg-highlight/50 text-left text-xs font-semibold uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-4 py-3">Receipt</th>
                  <th className="px-4 py-3">Received</th>
                  <th className="px-4 py-3">Expiration</th>
                  <th className="px-4 py-3">Received qty</th>
                  <th className="px-4 py-3">Left</th>
                  <th className="px-4 py-3">Supplier</th>
                  <th className="px-4 py-3">Purchase cost</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {batches.map((batch) => (
                  <tr key={batch.id}>
                    <td className="px-4 py-3 font-mono text-xs">{batch.id.slice(0, 8)}</td>
                    <td className="px-4 py-3">{formatDate(batch.received_at.slice(0, 10))}</td>
                    <td className="px-4 py-3">{batch.expiration_date ? formatDate(batch.expiration_date) : "No expiration date"}</td>
                    <td className="px-4 py-3">{batch.quantity_received}</td>
                    <td className="px-4 py-3">{batch.quantity_remaining}</td>
                    <td className="px-4 py-3">{batch.supplier ?? "—"}</td>
                    <td className="px-4 py-3">{batch.unit_cost !== null ? formatPeso(batch.unit_cost) : "—"}</td>
                    <td className="px-4 py-3">{EXPIRY_LABELS[batch.expiry_status]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
        )}
      </section>
    </>
  );
}
