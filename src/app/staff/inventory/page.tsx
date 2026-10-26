import type { Metadata } from "next";
import Link from "next/link";
import { setExpiryWarningAction } from "@/app/actions/inventory";
import { InventoryNotice } from "@/components/inventory/InventoryNotice";
import { InventorySectionLinks } from "@/components/inventory/InventorySectionLinks";
import { PosSubmitButton } from "@/components/pos/PosSubmitButton";
import { DashboardHeading } from "@/components/portal/PlaceholderCard";
import { FormField } from "@/components/ui/FormField";
import { panelClass } from "@/components/ui/panel-styles";
import { requireRole } from "@/lib/auth/session";
import { todayIso } from "@/lib/dates";
import { getWarningDays, listBatches, stockFacts } from "@/lib/inventory/server";
import { EXPIRY_LABELS, STOCK_LEVEL_LABELS } from "@/lib/inventory/status";
import { listCatalogProducts } from "@/lib/pos/server";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Inventory" };

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<{ stock?: string; expiry?: string; q?: string; notice?: string; error?: string }>;
}) {
  await requireRole(["STAFF", "SENIOR_VET"]);
  const query = await searchParams;
  const supabase = await createClient();
  const today = todayIso();
  const [products, batches, warningDays] = await Promise.all([
    listCatalogProducts(supabase),
    listBatches(supabase),
    getWarningDays(supabase),
  ]);
  const q = (query.q ?? "").trim().toLowerCase();
  const rows = products
    .map((product) => ({
      product,
      facts: stockFacts(
        product.quantity_on_hand,
        product.minimum_stock,
        batches.filter((batch) => batch.product_id === product.id),
        today,
      ),
    }))
    .filter(({ product, facts }) => {
      if (query.stock === "out" && (!product.is_active || facts.level !== "OUT")) return false;
      if (query.stock === "low" && (!product.is_active || facts.level !== "LOW")) return false;
      if (query.expiry === "expired" && (!product.is_active || !facts.hasExpired)) return false;
      if (query.expiry === "soon" && (!product.is_active || !facts.hasExpiringSoon)) return false;
      if (q && !product.name.toLowerCase().includes(q)) return false;
      return true;
    });

  return (
    <>
      <DashboardHeading
        title="Inventory"
        subtitle="Receive stock, record losses, and watch batches that are expiring."
      />
      <InventoryNotice notice={query.notice} error={query.error} />
      <InventorySectionLinks current="inventory" />
      <form action={setExpiryWarningAction} className="mb-6 flex flex-wrap items-end gap-3">
        <div className="w-full max-w-xs">
          <FormField
            label="Expiring soon window"
            name="days"
            inputMode="numeric"
            defaultValue={String(warningDays)}
            hint="Days before the expiration date. Staff and Senior Vet can change this."
          />
        </div>
        <PosSubmitButton pendingText="Saving...">Save window</PosSubmitButton>
      </form>
      <form className="mb-4 flex flex-wrap gap-3" action="/staff/inventory">
        <input
          name="q"
          defaultValue={query.q ?? ""}
          placeholder="Product name"
          className="min-h-11 rounded-lg border border-line px-3 text-sm"
        />
        <button type="submit" className="min-h-11 rounded-lg bg-brand px-5 text-sm font-semibold text-white">
          Search
        </button>
      </form>
      {rows.length === 0 ? (
        <section className="rounded-2xl border border-dashed border-line bg-white p-10 text-center text-sm text-muted">
          No products in this view. Add one from Products.
        </section>
      ) : (
        <section className={panelClass("overflow-x-auto")}>
          <table className="min-w-full divide-y divide-line text-sm">
            <thead className="bg-highlight/50 text-left text-xs font-semibold uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-3">Product</th>
                <th className="px-4 py-3">On hand</th>
                <th className="px-4 py-3">Sellable</th>
                <th className="px-4 py-3">Stock</th>
                <th className="px-4 py-3">Expiration</th>
                <th className="px-4 py-3"> </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map(({ product, facts }) => (
                <tr key={product.id}>
                  <td className="px-4 py-3">
                    <span className="font-medium text-ink">{product.name}</span>
                    <span className="mt-0.5 block text-xs text-muted">
                      {product.category} · {product.unit}
                      {product.supplier ? ` · ${product.supplier}` : ""}
                    </span>
                  </td>
                  <td className="px-4 py-3">{product.quantity_on_hand}</td>
                  <td className="px-4 py-3">{facts.sellable}</td>
                  <td className="px-4 py-3">{STOCK_LEVEL_LABELS[facts.level]}</td>
                  <td className="px-4 py-3">{facts.expiryStatus ? EXPIRY_LABELS[facts.expiryStatus] : "—"}</td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/staff/inventory/${product.id}`} className="font-semibold text-brand hover:underline">
                      Batches
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </>
  );
}
