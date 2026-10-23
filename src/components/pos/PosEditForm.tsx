"use client";

import { useMemo, useState, useTransition } from "react";
import { editCompletedPosAction } from "@/app/actions/pos";
import { buttonClass } from "@/components/ui/button-styles";
import { formatPeso, lineSubtotal } from "@/lib/pos/money";
import type { PosBill, SellableProduct, SellableService } from "@/lib/pos/types";

type Draft = {
  key: string;
  itemId: string | null;
  itemType: "SERVICE" | "PRODUCT";
  serviceId: string | null;
  productId: string | null;
  name: string;
  unitPrice: number;
  quantity: number;
  petId: string | null;
};

const fieldClass =
  "block min-h-11 w-full rounded-lg border border-line bg-white px-3 text-sm text-ink focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30";

function amount(value: number | string): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function PosEditForm({
  bill,
  services,
  products,
}: {
  bill: PosBill;
  services: SellableService[];
  products: SellableProduct[];
}) {
  const paid = amount(bill.amount_paid ?? bill.total);
  const [lines, setLines] = useState<Draft[]>(
    bill.items.map((item) => ({
      key: item.id,
      itemId: item.id,
      itemType: item.item_type,
      serviceId: item.service_id,
      productId: item.product_id,
      name: item.description,
      unitPrice: amount(item.unit_price),
      quantity: item.quantity,
      petId: item.pet_id,
    })),
  );
  const [serviceId, setServiceId] = useState(services[0]?.id ?? "");
  const [productId, setProductId] = useState(products[0]?.id ?? "");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const projected = useMemo(
    () => Math.round(lines.reduce((sum, line) => sum + lineSubtotal(line.unitPrice, line.quantity), 0) * 100) / 100,
    [lines],
  );
  const matches = projected === paid;

  function addService() {
    const service = services.find((item) => item.id === serviceId);
    if (!service) return;
    setLines((current) => [
      ...current,
      {
        key: `new-service-${service.id}-${current.length}`,
        itemId: null,
        itemType: "SERVICE",
        serviceId: service.id,
        productId: null,
        name: service.name,
        unitPrice: amount(service.price),
        quantity: 1,
        petId: bill.pet_id,
      },
    ]);
  }

  function addProduct() {
    const product = products.find((item) => item.id === productId);
    if (!product) return;
    setLines((current) => [
      ...current,
      {
        key: `new-product-${product.id}-${current.length}`,
        itemId: null,
        itemType: "PRODUCT",
        serviceId: null,
        productId: product.id,
        name: product.name,
        unitPrice: amount(product.price),
        quantity: 1,
        petId: null,
      },
    ]);
  }

  return (
    <form
      className="mt-4 space-y-3"
      onSubmit={(event) => {
        event.preventDefault();
        setError(null);
        startTransition(async () => {
          const result = await editCompletedPosAction({
            transactionId: bill.id,
            reason,
            items: lines.map((line) => ({
              itemId: line.itemId,
              itemType: line.itemType,
              serviceId: line.serviceId,
              productId: line.productId,
              petId: line.petId,
              quantity: line.quantity,
            })),
          });
          if (result?.error) setError(result.error);
        });
      }}
    >
      <ul className="divide-y divide-line">
        {lines.map((line) => (
          <li key={line.key} className="flex flex-wrap items-center justify-between gap-2 py-3">
            <div>
              <p className="font-medium text-ink">{line.name}</p>
              <p className="text-xs text-muted">{formatPeso(line.unitPrice)} each</p>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={1}
                max={999}
                value={line.quantity}
                onChange={(event) => {
                  const quantity = Number(event.target.value);
                  if (!Number.isInteger(quantity) || quantity < 1) return;
                  setLines((current) => current.map((item) => (item.key === line.key ? { ...item, quantity } : item)));
                }}
                className={`${fieldClass} w-24`}
              />
              <button
                type="button"
                className={buttonClass("outline")}
                onClick={() => setLines((current) => current.filter((item) => item.key !== line.key))}
              >
                Remove
              </button>
            </div>
          </li>
        ))}
      </ul>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <label htmlFor="edit-service" className="text-sm font-medium text-ink">Add a service</label>
          <select id="edit-service" value={serviceId} onChange={(event) => setServiceId(event.target.value)} className={fieldClass}>
            {services.map((service) => (
              <option key={service.id} value={service.id}>{service.name}</option>
            ))}
          </select>
          <button type="button" className={buttonClass("outline")} onClick={addService} disabled={!serviceId}>
            Add service
          </button>
        </div>
        <div className="space-y-2">
          <label htmlFor="edit-product" className="text-sm font-medium text-ink">Add a product</label>
          <select id="edit-product" value={productId} onChange={(event) => setProductId(event.target.value)} className={fieldClass}>
            {products.map((product) => (
              <option key={product.id} value={product.id}>{product.name}</option>
            ))}
          </select>
          <button type="button" className={buttonClass("outline")} onClick={addProduct} disabled={!productId}>
            Add product
          </button>
        </div>
      </div>
      <p className={`text-sm ${matches ? "text-muted" : "text-accent-dark"}`}>
        Projected total {formatPeso(projected)}. Amount already paid {formatPeso(paid)}.
        {matches ? "" : " These have to match. Otherwise void the bill and start a new sale."}
      </p>
      <label htmlFor="edit-reason" className="text-sm font-medium text-ink">Reason</label>
      <textarea id="edit-reason" required minLength={3} maxLength={500} value={reason} onChange={(event) => setReason(event.target.value)} className={fieldClass} rows={3} />
      {error && <p className="text-sm text-accent-dark">{error}</p>}
      <button type="submit" disabled={pending || !matches || lines.length === 0} className={buttonClass("primary")}>
        {pending ? "Saving..." : "Save edit"}
      </button>
    </form>
  );
}
