import type { Metadata } from "next";
import { ProductCatalog } from "@/components/pos/ProductCatalog";
import { PosNotice } from "@/components/pos/PosNotice";
import { DashboardHeading } from "@/components/portal/PlaceholderCard";
import { requireRole } from "@/lib/auth/session";
import { listCatalogProducts } from "@/lib/pos/server";
import { getProductImageUrls } from "@/lib/pos/images";
import { isUuid } from "@/lib/pets/constants";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Products" };

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string; notice?: string; error?: string }>;
}) {
  await requireRole(["STAFF", "SENIOR_VET"]);
  const query = await searchParams;
  const supabase = await createClient();
  const products = await listCatalogProducts(supabase);
  const imageUrls = await getProductImageUrls(
    supabase,
    products.map((product) => product.image_path),
  );
  const editId = query.edit && isUuid(query.edit) ? query.edit : "";
  const editing = editId ? products.find((product) => product.id === editId) ?? null : null;

  return (
    <>
      <DashboardHeading
        title="Products"
        subtitle="Sellable items for the counter. This is not the full inventory module."
      />
      <PosNotice notice={query.notice} error={query.error} />
      <ProductCatalog products={products} editing={editing} imageUrls={imageUrls} />
    </>
  );
}
