import Link from "next/link";
import { upsertProductAction } from "@/app/actions/pos";
import { ProductImageField } from "@/components/pos/ProductImageField";
import { PosSubmitButton } from "@/components/pos/PosSubmitButton";
import { FormField, SelectField, TextAreaField } from "@/components/ui/FormField";
import { panelClass, panelPaddingClass } from "@/components/ui/panel-styles";
import { stockLevel, STOCK_LEVEL_LABELS } from "@/lib/inventory/status";
import { formatPeso } from "@/lib/pos/money";
import { PRODUCT_CATEGORIES, type CatalogProduct } from "@/lib/pos/types";

export function ProductCatalog({
  products,
  editing,
  imageUrls,
}: {
  products: CatalogProduct[];
  editing: CatalogProduct | null;
  imageUrls: Record<string, string>;
}) {
  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <section className={panelClass("overflow-x-auto")}>
        <div className="p-6 pb-0">
          <h2 className="text-base font-semibold text-ink">Products</h2>
        </div>
        {products.length === 0 ? (
          <p className="p-6 text-sm text-muted">No products yet.</p>
        ) : (
          <table className="mt-4 min-w-full divide-y divide-line text-sm">
            <thead className="bg-highlight/50 text-left text-xs font-semibold uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Price</th>
                <th className="px-4 py-3">On hand</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3"> </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {products.map((product) => {
                const level = stockLevel(product.quantity_on_hand, product.minimum_stock);
                return (
                  <tr key={product.id}>
                    <td className="px-4 py-3">
                      <span className="font-medium text-ink">{product.name}</span>
                      <span className="mt-0.5 block text-xs text-muted">
                        {product.category} · {product.unit}
                      </span>
                    </td>
                    <td className="px-4 py-3">{formatPeso(product.price)}</td>
                    <td className="px-4 py-3">
                      {product.quantity_on_hand}
                      {level !== "OK" ? (
                        <span className="mt-1 block text-xs font-semibold text-accent">{STOCK_LEVEL_LABELS[level]}</span>
                      ) : null}
                      {product.sellable_quantity !== product.quantity_on_hand ? (
                        <span className="mt-1 block text-xs text-muted">{product.sellable_quantity} sellable</span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">{product.is_active ? "Active" : "Inactive"}</td>
                    <td className="px-4 py-3 text-right">
                      <a href={`/staff/products?edit=${product.id}`} className="font-semibold text-brand hover:underline">
                        Edit
                      </a>
                      <Link href={`/staff/inventory/${product.id}`} className="ml-3 font-semibold text-brand hover:underline">
                        Stock
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>

      <div className="space-y-6">
        <section className={panelPaddingClass()}>
          <h2 className="text-base font-semibold text-ink">{editing ? "Edit product" : "Add product"}</h2>
          <p className="mt-2 text-sm text-muted">
            An image is optional. Starting stock can be corrected until the first stock movement. After that, record the change in Inventory.
          </p>
          <form action={upsertProductAction} className="mt-4 space-y-4">
            {editing && <input type="hidden" name="productId" value={editing.id} />}
            <FormField label="Name" name="name" required maxLength={120} defaultValue={editing?.name ?? ""} />
            <SelectField label="Category" name="category" defaultValue={editing?.category ?? "General"}>
              {PRODUCT_CATEGORIES.map((category) => (
                <option key={category} value={category}>{category}</option>
              ))}
            </SelectField>
            <TextAreaField label="Description" name="description" defaultValue={editing?.description ?? ""} />
            <FormField label="Unit" name="unit" required maxLength={40} placeholder="piece, bottle, tablet" defaultValue={editing?.unit ?? ""} />
            <FormField label="Supplier" name="supplier" labelNote="(optional)" maxLength={120} defaultValue={editing?.supplier ?? ""} />
            <FormField label="Selling price" name="price" required inputMode="decimal" defaultValue={editing ? String(editing.price) : ""} />
            <FormField
              label="Unit cost"
              name="unitCost"
              labelNote="(optional)"
              inputMode="decimal"
              defaultValue={editing?.unit_cost === null || editing?.unit_cost === undefined ? "" : String(editing.unit_cost)}
            />
            {editing?.has_sales ? (
              <>
                <input type="hidden" name="quantityOnHand" value={String(editing.quantity_on_hand)} />
                <p className="text-sm text-muted">
                  On hand: {editing.quantity_on_hand}.{" "}
                  <Link href={`/staff/inventory/${editing.id}`} className="font-semibold text-brand hover:underline">
                    Record the next change in Inventory.
                  </Link>
                </p>
              </>
            ) : (
              <FormField label="Starting quantity" name="quantityOnHand" required inputMode="numeric" defaultValue={editing ? String(editing.quantity_on_hand) : "0"} />
            )}
            <FormField
              label="Minimum stock"
              name="minimumStock"
              labelNote="(optional)"
              inputMode="numeric"
              defaultValue={editing?.minimum_stock === null || editing?.minimum_stock === undefined ? "" : String(editing.minimum_stock)}
            />
            <SelectField label="Active" name="isActive" defaultValue={editing?.is_active === false ? "false" : "true"}>
              <option value="true">Yes</option>
              <option value="false">No</option>
            </SelectField>
            <ProductImageField currentUrl={editing?.image_path ? imageUrls[editing.image_path] ?? null : null} />
            <PosSubmitButton pendingText="Saving...">{editing ? "Save product" : "Add product"}</PosSubmitButton>
          </form>
        </section>
      </div>
    </div>
  );
}
