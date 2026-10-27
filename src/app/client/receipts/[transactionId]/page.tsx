import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DashboardHeading } from "@/components/portal/PlaceholderCard";
import { panelClass } from "@/components/ui/panel-styles";
import { requireRole } from "@/lib/auth/session";
import { formatDate } from "@/lib/dates";
import { formatPeso } from "@/lib/pos/money";
import { getClientReceipt } from "@/lib/pos/receipts";
import { isUuid } from "@/lib/pets/constants";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Receipt" };

export default async function ClientReceiptPage({
  params,
}: {
  params: Promise<{ transactionId: string }>;
}) {
  await requireRole(["CLIENT"]);
  const { transactionId } = await params;
  if (!isUuid(transactionId)) notFound();
  const supabase = await createClient();
  const receipt = await getClientReceipt(supabase, transactionId);
  if (!receipt) notFound();

  return (
    <>
      <Link href="/client/receipts" className="text-sm font-semibold text-brand hover:underline">
        Back to receipts
      </Link>
      <DashboardHeading
        title={receipt.reference}
        subtitle={`${formatDate(receipt.occurredAt)}${receipt.petName ? ` · ${receipt.petName}` : ""}${receipt.status === "VOIDED" ? " · Voided" : " · Paid"}`}
      />
      <section className={panelClass("overflow-x-auto")}>
        <table className="min-w-full divide-y divide-line text-sm">
          <thead className="bg-highlight/50 text-left text-xs font-semibold uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-3">Item</th>
              <th className="px-4 py-3">Qty</th>
              <th className="px-4 py-3">Price</th>
              <th className="px-4 py-3">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {receipt.lines.map((line) => (
              <tr key={line.id}>
                <td className="px-4 py-3">{line.description}</td>
                <td className="px-4 py-3">{line.quantity}</td>
                <td className="px-4 py-3">{formatPeso(line.unitPrice)}</td>
                <td className="px-4 py-3">{formatPeso(line.subtotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="px-4 py-4 text-right text-sm font-semibold text-ink">Amount paid {formatPeso(receipt.amountPaid)}</p>
      </section>
    </>
  );
}
