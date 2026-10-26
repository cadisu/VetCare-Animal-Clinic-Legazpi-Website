import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { InventoryMovementForm } from "@/components/inventory/InventoryMovementForm";
import { InventoryNotice } from "@/components/inventory/InventoryNotice";
import { InventorySectionLinks } from "@/components/inventory/InventorySectionLinks";
import { DashboardHeading } from "@/components/portal/PlaceholderCard";
import { panelClass, panelPaddingClass } from "@/components/ui/panel-styles";
import { requireRole } from "@/lib/auth/session";
import { formatDate } from "@/lib/dates";
import { listBatches } from "@/lib/inventory/server";
import { EXPIRY_LABELS } from "@/lib/inventory/status";
import { formatPeso } from "@/lib/pos/money";
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

  return (
    <>
      <DashboardHeading
        title={product.name}
        subtitle={`${product.category} · ${product.unit}. On hand ${product.quantity_on_hand}, sellable ${product.sellable_quantity}.`}
      />
      <InventoryNotice notice={query.notice} error={query.error} />
      <InventorySectionLinks current="inventory" />
      <div className="grid gap-8 lg:grid-cols-2">
        <section className={panelClass("overflow-x-auto")}>
          <div className="flex items-start justify-between gap-3 p-6 pb-0">
            <h2 className="text-base font-semibold text-ink">Batches</h2>
            <Link href={`/staff/inventory/history?product=${product.id}`} className="text-sm font-semibold text-brand hover:underline">
              History
            </Link>
          </div>
          {batches.length === 0 ? (
            <p className="p-6 text-sm text-muted">No batches yet. Record a stock-in to receive some.</p>
          ) : (
            <table className="mt-4 min-w-full divide-y divide-line text-sm">
              <thead className="bg-highlight/50 text-left text-xs font-semibold uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-4 py-3">Received</th>
                  <th className="px-4 py-3">Expiration</th>
                  <th className="px-4 py-3">Left</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {batches.map((batch) => (
                  <tr key={batch.id}>
                    <td className="px-4 py-3">
                      {formatDate(batch.received_at.slice(0, 10))}
                      {batch.supplier ? <span className="mt-0.5 block text-xs text-muted">{batch.supplier}</span> : null}
                    </td>
                    <td className="px-4 py-3">{batch.expiration_date ? formatDate(batch.expiration_date) : "None"}</td>
                    <td className="px-4 py-3">
                      {batch.quantity_remaining}
                      {batch.unit_cost !== null ? (
                        <span className="mt-0.5 block text-xs text-muted">{formatPeso(batch.unit_cost)} cost</span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">{EXPIRY_LABELS[batch.expiry_status]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
        <section className={panelPaddingClass()}>
          <h2 className="text-base font-semibold text-ink">Record a movement</h2>
          <p className="mt-2 text-sm text-muted">
            Stock-in adds a batch. Damaged, missing, expired, and stock-out remove units from the batch you choose. A reason is kept with the movement.
          </p>
          <InventoryMovementForm
            productId={product.id}
            batches={batches.map((batch) => ({
              id: batch.id,
              quantityRemaining: batch.quantity_remaining,
              expiryStatus: batch.expiry_status,
              label: `${batch.expiration_date ? formatDate(batch.expiration_date) : "No expiration"} · ${batch.quantity_remaining} left`,
            }))}
          />
        </section>
      </div>
    </>
  );
}
