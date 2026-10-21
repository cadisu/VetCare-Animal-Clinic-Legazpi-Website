import Link from "next/link";
import { upsertProductAction } from "@/app/actions/pos";
import { PosSubmitButton } from "@/components/pos/PosSubmitButton";
import { FormField, SelectField } from "@/components/ui/FormField";
import { panelClass, panelPaddingClass } from "@/components/ui/panel-styles";
import { formatPeso } from "@/lib/pos/money";
import type { CatalogProduct } from "@/lib/pos/types";

export function ProductCatalog({
  products,
  editing,
  canEdit,
}: {
  products: CatalogProduct[];
  editing: CatalogProduct | null;
  canEdit: boolean;
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
                {canEdit && <th className="px-4 py-3"> </th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {products.map((product) => (
                <tr key={product.id}>
                  <td className="px-4 py-3">
                    <span className="font-medium text-ink">{product.name}</span>
                    <span className="mt-0.5 block text-xs text-muted">{product.unit}</span>
                  </td>
                  <td className="px-4 py-3">{formatPeso(product.price)}</td>
                  <td className="px-4 py-3">{product.quantity_on_hand}</td>
                  <td className="px-4 py-3">{product.is_active ? "Active" : "Inactive"}</td>
                  {canEdit && (
                    <td className="px-4 py-3 text-right">
                      <Link href={`/staff/products?edit=${product.id}`} className="font-semibold text-brand hover:underline">
                        Edit
                      </Link>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className={panelPaddingClass()}>
        {canEdit ? (
          <>
            <h2 className="text-base font-semibold text-ink">{editing ? "Edit product" : "Add product"}</h2>
            <p className="mt-2 text-sm text-muted">
              Starting stock can be corrected until the first sale. After that, quantity changes only when a bill
              is completed or voided.
            </p>
            <form action={upsertProductAction} className="mt-4 space-y-4">
              {editing && <input type="hidden" name="productId" value={editing.id} />}
              <FormField label="Name" name="name" required maxLength={120} defaultValue={editing?.name ?? ""} />
              <FormField
                label="Unit"
                name="unit"
                required
                maxLength={40}
                placeholder="piece, bottle, tablet"
                defaultValue={editing?.unit ?? ""}
              />
              <FormField
                label="Price"
                name="price"
                required
                inputMode="decimal"
                defaultValue={editing ? String(editing.price) : ""}
              />
              {editing?.has_sales ? (
                <>
                  <input type="hidden" name="quantityOnHand" value={String(editing.quantity_on_hand)} />
                  <p className="text-sm text-muted">On hand: {editing.quantity_on_hand}. Sales have started, so this number is locked here.</p>
                </>
              ) : (
                <FormField
                  label="Starting quantity"
                  name="quantityOnHand"
                  required
                  inputMode="numeric"
                  defaultValue={editing ? String(editing.quantity_on_hand) : "0"}
                />
              )}
              <SelectField
                label="Active"
                name="isActive"
                defaultValue={editing?.is_active === false ? "false" : "true"}
              >
                <option value="true">Yes</option>
                <option value="false">No</option>
              </SelectField>
              <PosSubmitButton pendingText="Saving...">{editing ? "Save product" : "Add product"}</PosSubmitButton>
            </form>
          </>
        ) : (
          <>
            <h2 className="text-base font-semibold text-ink">Product list</h2>
            <p className="mt-2 text-sm text-muted">
              A Senior Vet maintains names, prices, and starting stock. You can sell active products from POS.
            </p>
          </>
        )}
      </section>
    </div>
  );
}
