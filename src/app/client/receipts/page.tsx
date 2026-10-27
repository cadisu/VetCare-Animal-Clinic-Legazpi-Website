import type { Metadata } from "next";
import Link from "next/link";
import { DashboardHeading } from "@/components/portal/PlaceholderCard";
import { panelPaddingClass } from "@/components/ui/panel-styles";
import { requireRole } from "@/lib/auth/session";
import { formatDate } from "@/lib/dates";
import { formatPeso } from "@/lib/pos/money";
import { listClientReceipts } from "@/lib/pos/receipts";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Receipts" };

export default async function ClientReceiptsPage() {
  await requireRole(["CLIENT"]);
  const supabase = await createClient();
  const receipts = await listClientReceipts(supabase);

  return (
    <>
      <DashboardHeading title="Receipts" subtitle="Completed and voided bills from the clinic. These cannot be changed here." />
      {receipts.length === 0 ? (
        <p className="text-sm text-muted">No receipts yet.</p>
      ) : (
        <ul className="space-y-3">
          {receipts.map((receipt) => (
            <li key={receipt.id}>
              <Link href={`/client/receipts/${receipt.id}`} className={panelPaddingClass("block hover:bg-highlight/40")}>
                <span className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-semibold text-ink">{receipt.reference}</span>
                  <span className="text-sm font-semibold text-ink">{formatPeso(receipt.total)}</span>
                </span>
                <span className="mt-1 block text-sm text-muted">
                  {formatDate(receipt.occurredAt)}
                  {receipt.petName ? ` · ${receipt.petName}` : ""}
                  {receipt.status === "VOIDED" ? " · Voided" : ""}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
