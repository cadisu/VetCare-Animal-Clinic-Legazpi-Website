import Link from "next/link";
import {
  addProductItemAction,
  addServiceItemAction,
  completePosAction,
  removeItemAction,
  setItemQuantityAction,
  voidPosAction,
} from "@/app/actions/pos";
import { PosSubmitButton } from "@/components/pos/PosSubmitButton";
import { ConfirmSubmitButton } from "@/components/ui/ConfirmSubmitButton";
import { panelPaddingClass } from "@/components/ui/panel-styles";
import { formatClinicDateTime, formatPeso } from "@/lib/pos/money";
import { POS_STATUS_LABELS } from "@/lib/pos/status";
import type { PosBill, SellableProduct, SellableService } from "@/lib/pos/types";

const fieldClass =
  "block min-h-11 w-full rounded-lg border border-line bg-white px-3 text-sm text-ink focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30";

function statusClass(status: PosBill["status"]): string {
  if (status === "COMPLETED") return "bg-emerald-50 text-emerald-800";
  if (status === "VOIDED") return "bg-highlight text-ink";
  return "bg-amber-50 text-amber-900";
}

export function PosCheckout({
  bill,
  services,
  products,
  billedServiceIds,
  visitServiceNeedsPrice,
  canVoidCompleted,
}: {
  bill: PosBill;
  services: SellableService[];
  products: SellableProduct[];
  billedServiceIds: string[];
  visitServiceNeedsPrice: boolean;
  canVoidCompleted: boolean;
}) {
  const open = bill.status === "OPEN";
  const availableServices = services.filter((service) => !billedServiceIds.includes(service.id));
  const amount = formatPeso(bill.status === "OPEN" ? bill.total : bill.amount_paid ?? bill.total);

  return (
    <div className="space-y-6">
      <section className={panelPaddingClass()}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">{bill.reference}</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-ink">{bill.client_name}</h1>
            <p className="mt-1 text-sm text-muted">
              {bill.pet_name ? `Pet: ${bill.pet_name}` : "No pet on this sale"}
              {bill.appointment_id && (
                <>
                  {" "}
                  ·{" "}
                  <Link
                    href={`/staff/appointments/${bill.appointment_id}`}
                    className="font-semibold text-brand hover:underline"
                  >
                    View visit
                  </Link>
                </>
              )}
            </p>
          </div>
          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusClass(bill.status)}`}>
            {POS_STATUS_LABELS[bill.status]}
          </span>
        </div>
        {open && (
          <p className="mt-4 text-sm text-muted">
            The client pays at the counter. This records the services, products, and amount paid. It does not
            charge a card online, and it does not mark the visit completed.
          </p>
        )}
        {visitServiceNeedsPrice && (
          <p className="mt-4 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-900">
            This visit&apos;s service has no price yet. Set one under{" "}
            <Link href="/staff/services" className="font-semibold underline">
              Clinic services
            </Link>{" "}
            before it can be added.
          </p>
        )}
      </section>

      <section className={panelPaddingClass()}>
        <h2 className="text-base font-semibold text-ink">Items</h2>
        {bill.items.length === 0 ? (
          <p className="mt-4 text-sm text-muted">Nothing on this bill yet.</p>
        ) : (
          <ul className="mt-2 divide-y divide-line">
            {bill.items.map((item) => (
              <li key={item.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-medium text-ink">{item.description}</p>
                  <p className="text-xs uppercase text-muted">{item.item_type === "SERVICE" ? "Service" : "Product"}</p>
                  <p className="mt-1 text-sm text-muted">
                    {item.quantity} × {formatPeso(item.unit_price)}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <p className="font-semibold text-ink">{formatPeso(item.subtotal)}</p>
                  {open && (
                    <>
                      <form action={setItemQuantityAction} className="flex items-center gap-2">
                        <input type="hidden" name="transactionId" value={bill.id} />
                        <input type="hidden" name="itemId" value={item.id} />
                        <label htmlFor={`qty-${item.id}`} className="sr-only">
                          Quantity for {item.description}
                        </label>
                        <input
                          id={`qty-${item.id}`}
                          name="quantity"
                          type="number"
                          min={1}
                          max={999}
                          defaultValue={item.quantity}
                          className={`${fieldClass} w-24`}
                        />
                        <PosSubmitButton variant="outline" pendingText="Saving...">
                          Update
                        </PosSubmitButton>
                      </form>
                      <form action={removeItemAction}>
                        <input type="hidden" name="transactionId" value={bill.id} />
                        <input type="hidden" name="itemId" value={item.id} />
                        <ConfirmSubmitButton
                          confirmMessage={`Remove ${item.description} from this bill?`}
                          pendingText="Removing..."
                        >
                          Remove
                        </ConfirmSubmitButton>
                      </form>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}

        <dl className="mt-4 space-y-2 border-t border-line pt-4 text-sm">
          <div className="flex justify-between gap-3">
            <dt className="text-muted">Subtotal</dt>
            <dd>{formatPeso(bill.subtotal)}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-muted">Discount</dt>
            <dd>{formatPeso(0)}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-muted">Reward</dt>
            <dd>{formatPeso(0)}</dd>
          </div>
          <div className="flex justify-between gap-3 text-base font-semibold text-ink">
            <dt>{open ? "Amount to record" : "Amount paid"}</dt>
            <dd>{amount}</dd>
          </div>
        </dl>
        <p className="mt-2 text-xs text-muted">Rewards are not available yet. Discount and reward stay at zero.</p>
        {bill.status === "COMPLETED" && (
          <p className="mt-3 text-sm text-muted">
            Paid at the counter {formatClinicDateTime(bill.completed_at)}
            {bill.processor_name ? ` · recorded by ${bill.processor_name}` : ""}.
          </p>
        )}
        {bill.status === "VOIDED" && (
          <p className="mt-3 text-sm text-muted">
            Voided {formatClinicDateTime(bill.voided_at)}
            {bill.voided_by_name ? ` by ${bill.voided_by_name}` : ""}. Reason: {bill.void_reason}
          </p>
        )}
      </section>

      {open && (
        <div className="grid gap-6 lg:grid-cols-2">
          {bill.appointment_id && (
            <section className={panelPaddingClass()}>
              <h2 className="text-base font-semibold text-ink">Add a service</h2>
              {availableServices.length === 0 ? (
                <p className="mt-3 text-sm text-muted">
                  No priced service is left to add. Set prices under Clinic services, or this visit&apos;s services
                  are already billed.
                </p>
              ) : (
                <form action={addServiceItemAction} className="mt-4 space-y-3">
                  <input type="hidden" name="transactionId" value={bill.id} />
                  <label htmlFor="serviceId" className="text-sm font-medium text-ink">
                    Service
                  </label>
                  <select id="serviceId" name="serviceId" required className={fieldClass}>
                    {availableServices.map((service) => (
                      <option key={service.id} value={service.id}>
                        {service.name} · {formatPeso(service.price)}
                      </option>
                    ))}
                  </select>
                  <label htmlFor="service-quantity" className="text-sm font-medium text-ink">
                    Quantity
                  </label>
                  <input
                    id="service-quantity"
                    name="quantity"
                    type="number"
                    min={1}
                    max={999}
                    defaultValue={1}
                    required
                    className={fieldClass}
                  />
                  <PosSubmitButton pendingText="Adding...">Add service</PosSubmitButton>
                </form>
              )}
            </section>
          )}

          <section className={panelPaddingClass()}>
            <h2 className="text-base font-semibold text-ink">Add a product</h2>
            {products.length === 0 ? (
              <p className="mt-3 text-sm text-muted">
                No active products yet. A Senior Vet can add them under Products.
              </p>
            ) : (
              <form action={addProductItemAction} className="mt-4 space-y-3">
                <input type="hidden" name="transactionId" value={bill.id} />
                <label htmlFor="productId" className="text-sm font-medium text-ink">
                  Product
                </label>
                <select id="productId" name="productId" required className={fieldClass}>
                  {products.map((product) => (
                    <option key={product.id} value={product.id} disabled={product.quantity_on_hand < 1}>
                      {product.name} · {formatPeso(product.price)} · {product.quantity_on_hand} {product.unit} on hand
                    </option>
                  ))}
                </select>
                <label htmlFor="product-quantity" className="text-sm font-medium text-ink">
                  Quantity
                </label>
                <input
                  id="product-quantity"
                  name="quantity"
                  type="number"
                  min={1}
                  max={999}
                  defaultValue={1}
                  required
                  className={fieldClass}
                />
                <PosSubmitButton pendingText="Adding...">Add product</PosSubmitButton>
              </form>
            )}
          </section>
        </div>
      )}

      {open && (
        <section className={panelPaddingClass()}>
          <h2 className="text-base font-semibold text-ink">Record payment</h2>
          <p className="mt-2 text-sm text-muted">
            Confirm that the client paid {amount} at the counter. The saved total is calculated by the database
            from the line items.
          </p>
          {bill.items.length === 0 ? (
            <p className="mt-4 text-sm text-muted">Add a service or product before recording the amount paid.</p>
          ) : (
            <form action={completePosAction} className="mt-4">
              <input type="hidden" name="transactionId" value={bill.id} />
              <ConfirmSubmitButton
                variant="primary"
                pendingText="Recording..."
                confirmMessage={`Record ${amount} as paid at the counter? This does not charge a card online, and it does not mark the visit completed.`}
              >
                Record amount paid
              </ConfirmSubmitButton>
            </form>
          )}
        </section>
      )}

      {open && (
        <section className={panelPaddingClass()}>
          <h2 className="text-base font-semibold text-ink">Cancel this open bill</h2>
          <p className="mt-2 text-sm text-muted">
            An open bill has not taken stock. Cancelling keeps a voided row instead of deleting it.
          </p>
          <form action={voidPosAction} className="mt-4 space-y-3">
            <input type="hidden" name="transactionId" value={bill.id} />
            <label htmlFor="void-reason" className="text-sm font-medium text-ink">
              Reason
            </label>
            <textarea
              id="void-reason"
              name="reason"
              required
              minLength={3}
              maxLength={500}
              rows={3}
              className={fieldClass}
            />
            <ConfirmSubmitButton
              confirmMessage="Void this open bill? It will stay in the history."
              pendingText="Voiding..."
            >
              Void open bill
            </ConfirmSubmitButton>
          </form>
        </section>
      )}

      {bill.status === "COMPLETED" && (
        <section className={panelPaddingClass()}>
          <h2 className="text-base font-semibold text-ink">Void this bill</h2>
          {canVoidCompleted ? (
            <>
              <p className="mt-2 text-sm text-muted">
                Voiding keeps the original bill in history. Product stock from this bill is put back. The visit
                status does not change.
              </p>
              <form action={voidPosAction} className="mt-4 space-y-3">
                <input type="hidden" name="transactionId" value={bill.id} />
                <label htmlFor="void-completed-reason" className="text-sm font-medium text-ink">
                  Reason
                </label>
                <textarea
                  id="void-completed-reason"
                  name="reason"
                  required
                  minLength={3}
                  maxLength={500}
                  rows={3}
                  className={fieldClass}
                />
                <ConfirmSubmitButton
                  confirmMessage="Void this completed bill and restore any product stock? The visit status will stay as it is."
                  pendingText="Voiding..."
                >
                  Void completed bill
                </ConfirmSubmitButton>
              </form>
            </>
          ) : (
            <p className="mt-2 text-sm text-muted">A Senior Vet can void this completed bill if it needs a correction.</p>
          )}
        </section>
      )}
    </div>
  );
}
