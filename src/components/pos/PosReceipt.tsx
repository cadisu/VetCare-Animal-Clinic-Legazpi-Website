import Link from "next/link";
import { voidPosAction } from "@/app/actions/pos";
import { PosEditForm } from "@/components/pos/PosEditForm";
import { ConfirmSubmitButton } from "@/components/ui/ConfirmSubmitButton";
import { buttonClass } from "@/components/ui/button-styles";
import { panelPaddingClass } from "@/components/ui/panel-styles";
import { formatClinicDateTime, formatPeso } from "@/lib/pos/money";
import { POS_STATUS_LABELS } from "@/lib/pos/status";
import type { PosBill, PosEdit, SellableProduct, SellableService } from "@/lib/pos/types";

export function PosReceipt({
  bill,
  edits,
  services,
  products,
  canEditCompleted,
}: {
  bill: PosBill;
  edits: PosEdit[];
  services: SellableService[];
  products: SellableProduct[];
  canEditCompleted: boolean;
}) {
  return (
    <div className="space-y-6">
      <section className={panelPaddingClass()}>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">{bill.reference}</p>
        <h1 className="mt-1 text-2xl font-bold text-ink">{bill.client_name}</h1>
        <p className="mt-1 text-sm text-muted">
          {POS_STATUS_LABELS[bill.status]}
          {bill.pet_name ? ` · ${bill.pet_name}` : ""}
          {bill.walk_in_contact ? ` · ${bill.walk_in_contact}` : ""}
        </p>
        {bill.appointment_id && (
          <p className="mt-2 text-sm">
            <Link href={`/staff/appointments/${bill.appointment_id}`} className="font-semibold text-brand hover:underline">
              View visit
            </Link>
          </p>
        )}
        <ul className="mt-4 divide-y divide-line text-sm">
          {bill.items.map((item) => (
            <li key={item.id} className="flex justify-between gap-3 py-3">
              <span>
                {item.description}
                <span className="mt-1 block text-xs uppercase text-muted">
                  {item.item_type === "SERVICE" ? "Service" : "Product"} · {item.quantity} × {formatPeso(item.unit_price)}
                </span>
              </span>
              <span className="font-semibold">{formatPeso(item.subtotal)}</span>
            </li>
          ))}
        </ul>
        <dl className="mt-4 space-y-2 text-sm">
          <div className="flex justify-between"><dt>Subtotal</dt><dd>{formatPeso(bill.subtotal)}</dd></div>
          <div className="flex justify-between"><dt>Discount</dt><dd>{formatPeso(0)}</dd></div>
          <div className="flex justify-between">
            <dt>{bill.reward_label ? `Reward · ${bill.reward_label}` : "Reward"}</dt>
            <dd>{formatPeso(bill.reward_amount)}</dd>
          </div>
          <div className="flex justify-between text-base font-semibold"><dt>Total</dt><dd>{formatPeso(bill.total)}</dd></div>
          {bill.amount_tendered !== null && (
            <>
              <div className="flex justify-between"><dt>Cash received</dt><dd>{formatPeso(bill.amount_tendered)}</dd></div>
              <div className="flex justify-between"><dt>Change</dt><dd>{formatPeso(bill.change_amount)}</dd></div>
            </>
          )}
        </dl>
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
        <Link href="/staff/pos" className={buttonClass("primary", "md", "mt-4")}>
          New sale
        </Link>
      </section>

      {edits.length > 0 && (
        <section className={panelPaddingClass()}>
          <h2 className="text-base font-semibold text-ink">Edit history</h2>
          <ul className="mt-3 space-y-3 text-sm">
            {edits.map((edit) => (
              <li key={edit.id}>
                <p className="font-medium text-ink">{formatClinicDateTime(edit.created_at)}</p>
                <p className="text-muted">
                  {edit.editor_name ?? "Senior Vet"} · previous total {formatPeso(edit.previous_total)}
                </p>
                <p>{edit.reason}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {bill.status === "COMPLETED" && canEditCompleted && (
        <section className={panelPaddingClass()}>
          <h2 className="text-base font-semibold text-ink">Edit this bill</h2>
          <p className="mt-2 text-sm text-muted">
            Existing line prices stay as they were when the bill was paid. The new total must equal the amount already paid.
          </p>
          <PosEditForm bill={bill} services={services} products={products} />
        </section>
      )}

      {bill.status === "COMPLETED" && (
        <section className={panelPaddingClass()}>
          <h2 className="text-base font-semibold text-ink">Void this bill</h2>
          {canEditCompleted ? (
            <form action={voidPosAction} className="mt-4 space-y-3">
              <input type="hidden" name="transactionId" value={bill.id} />
              <label htmlFor="void-reason" className="text-sm font-medium text-ink">Reason</label>
              <textarea id="void-reason" name="reason" required minLength={3} maxLength={500} rows={3} className="block min-h-11 w-full rounded-lg border border-line px-3 py-2 text-sm" />
              <ConfirmSubmitButton
                confirmMessage="Void this completed bill and restore any product stock? The visit status will stay as it is."
                pendingText="Voiding..."
              >
                Void completed bill
              </ConfirmSubmitButton>
            </form>
          ) : (
            <p className="mt-2 text-sm text-muted">A Senior Vet can void this completed bill if it needs a correction.</p>
          )}
        </section>
      )}
    </div>
  );
}
