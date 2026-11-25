import type { Metadata } from "next";
import Link from "next/link";
import { InventoryNotice } from "@/components/inventory/InventoryNotice";
import { InventorySectionLinks } from "@/components/inventory/InventorySectionLinks";
import { DashboardHeading } from "@/components/portal/PlaceholderCard";
import { buttonClass } from "@/components/ui/button-styles";
import { panelClass } from "@/components/ui/panel-styles";
import { requireRole } from "@/lib/auth/session";
import { listInventoryMovements } from "@/lib/inventory/server";
import { isMovementType, MOVEMENT_LABELS, MOVEMENT_TYPES } from "@/lib/inventory/status";
import { formatClinicDateTime, formatPeso } from "@/lib/pos/money";
import { listCatalogProducts } from "@/lib/pos/server";
import { isUuid } from "@/lib/pets/constants";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Inventory history" };

export default async function InventoryHistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ product?: string; type?: string; from?: string; to?: string; q?: string; notice?: string; error?: string }>;
}) {
  await requireRole(["STAFF", "SENIOR_VET"]);
  const query = await searchParams;
  const productId = query.product && isUuid(query.product) ? query.product : "";
  const movementType = query.type && isMovementType(query.type) ? query.type : "";
  const supabase = await createClient();
  const [products, rows] = await Promise.all([
    listCatalogProducts(supabase),
    listInventoryMovements(supabase, {
      productId: productId || undefined,
      movementType: movementType || undefined,
      from: query.from,
      to: query.to,
      query: query.q,
    }),
  ]);

  return (
    <>
      <DashboardHeading title="Movement history" />
      <InventoryNotice notice={query.notice} error={query.error} />
      <InventorySectionLinks current="history" />
      <form className="mb-6 grid gap-3 lg:grid-cols-5" action="/staff/inventory/history">
        <input
          name="q"
          defaultValue={query.q ?? ""}
          placeholder="Product, reason, or supplier"
          className="min-h-11 rounded-lg border border-line px-3 text-sm"
        />
        <select name="product" defaultValue={productId} className="min-h-11 rounded-lg border border-line px-3 text-sm">
          <option value="">All products</option>
          {products.map((product) => (
            <option key={product.id} value={product.id}>
              {product.name}
            </option>
          ))}
        </select>
        <select name="type" defaultValue={movementType} className="min-h-11 rounded-lg border border-line px-3 text-sm">
          <option value="">All types</option>
          {MOVEMENT_TYPES.map((type) => (
            <option key={type} value={type}>
              {MOVEMENT_LABELS[type]}
            </option>
          ))}
        </select>
        <input name="from" type="date" defaultValue={query.from ?? ""} className="min-h-11 rounded-lg border border-line px-3 text-sm" />
        <input name="to" type="date" defaultValue={query.to ?? ""} className="min-h-11 rounded-lg border border-line px-3 text-sm" />
        <button type="submit" className={buttonClass("primary")}>
          Search
        </button>
      </form>
      {rows.length === 0 ? (
        <section className="rounded-2xl border border-dashed border-line bg-white p-10 text-center text-sm text-muted">
          No movements in this view yet.
        </section>
      ) : (
        <section className={panelClass("overflow-x-auto")}>
          <table className="min-w-full divide-y divide-line text-sm">
            <thead className="bg-highlight/50 text-left text-xs font-semibold uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-3">When</th>
                <th className="px-4 py-3">Product</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Quantity</th>
                <th className="px-4 py-3">Batch</th>
                <th className="px-4 py-3">Reason</th>
                <th className="px-4 py-3">User</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((row) => (
                <tr key={row.id}>
                  <td className="px-4 py-3 whitespace-nowrap">{formatClinicDateTime(row.created_at)}</td>
                  <td className="px-4 py-3">
                    <Link href={`/staff/inventory/${row.product_id}`} className="font-medium text-brand hover:underline">
                      {row.product_name}
                    </Link>
                  </td>
                  <td className="px-4 py-3">{MOVEMENT_LABELS[row.movement_type]}</td>
                  <td className="px-4 py-3">
                    {row.quantity_delta > 0 ? "+" : ""}
                    {row.quantity_delta} {row.unit}
                    {row.unit_cost !== null ? (
                      <span className="mt-0.5 block text-xs text-muted">{formatPeso(row.unit_cost)} purchase cost</span>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted">{row.batch_label}</td>
                  <td className="px-4 py-3">
                    {row.reason ?? "—"}
                    {row.supplier ? <span className="mt-0.5 block text-xs text-muted">{row.supplier}</span> : null}
                    {row.reference_note ? <span className="mt-0.5 block text-xs text-muted">{row.reference_note}</span> : null}
                  </td>
                  <td className="px-4 py-3">{row.actor_name ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </>
  );
}
