import type { Metadata } from "next";
import { InventoryCatalog } from "@/components/inventory/InventoryCatalog";
import { InventoryNotice } from "@/components/inventory/InventoryNotice";
import { InventorySectionLinks } from "@/components/inventory/InventorySectionLinks";
import { DashboardHeading } from "@/components/portal/PlaceholderCard";
import { requireRole } from "@/lib/auth/session";
import { formatDate, todayIso } from "@/lib/dates";
import { listBatches, stockFacts } from "@/lib/inventory/server";
import { getProductImageUrls } from "@/lib/pos/images";
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
  const [products, batches] = await Promise.all([
    listCatalogProducts(supabase),
    listBatches(supabase),
  ]);
  const imageUrls = await getProductImageUrls(
    supabase,
    products.map((product) => product.image_path),
  );
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
    })
    .sort((a, b) => Number(b.product.is_active) - Number(a.product.is_active));

  return (
    <>
      <DashboardHeading title="Inventory" />
      <InventoryNotice notice={query.notice} error={query.error} />
      <InventorySectionLinks current="inventory" />
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
      <InventoryCatalog
        imageUrls={imageUrls}
        batches={batches.map((batch) => ({
          id: batch.id,
          productId: batch.product_id,
          expirationDate: batch.expiration_date,
          label: `${batch.id.slice(0, 8)} · ${formatDate(batch.received_at.slice(0, 10))}`,
        }))}
        rows={rows.map(({ product, facts }) => ({
          product,
          level: facts.level,
          sellable: facts.sellable,
          expiryStatus: facts.expiryStatus,
        }))}
      />
    </>
  );
}
