import type { Metadata } from "next";
import Link from "next/link";
import { PosNotice } from "@/components/pos/PosNotice";
import { DashboardHeading } from "@/components/portal/PlaceholderCard";
import { buttonClass } from "@/components/ui/button-styles";
import { panelClass } from "@/components/ui/panel-styles";
import { requireRole } from "@/lib/auth/session";
import { formatClinicDateTime, formatPeso } from "@/lib/pos/money";
import { listPosTransactions } from "@/lib/pos/server";
import { POS_STATUS_LABELS, type PosStatus } from "@/lib/pos/status";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Transaction history" };

function historyStatus(value: string | undefined): PosStatus[] {
  if (value === "COMPLETED" || value === "VOIDED") return [value];
  return ["COMPLETED", "VOIDED"];
}

export default async function PosHistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; notice?: string; error?: string }>;
}) {
  await requireRole(["STAFF", "SENIOR_VET"]);
  const query = await searchParams;
  const statuses = historyStatus(query.status);
  const supabase = await createClient();
  const rows = await listPosTransactions(supabase, statuses, 100);
  const current = statuses.length === 1 ? statuses[0] : "ALL";

  return (
    <>
      <DashboardHeading
        title="Transaction history"
        subtitle="Completed and voided bills stay here. They are not deleted."
      />
      <PosNotice notice={query.notice} error={query.error} />
      <div className="mb-6 flex flex-wrap gap-2">
        {(
          [
            ["ALL", "All"],
            ["COMPLETED", "Completed"],
            ["VOIDED", "Voided"],
          ] as const
        ).map(([value, label]) => (
          <Link
            key={value}
            href={value === "ALL" ? "/staff/pos/history" : `/staff/pos/history?status=${value}`}
            className={buttonClass(current === value ? "primary" : "outline")}
          >
            {label}
          </Link>
        ))}
      </div>
      {rows.length === 0 ? (
        <section className="rounded-2xl border border-dashed border-line bg-white p-10 text-center text-sm text-muted">
          No bills in this view yet.
        </section>
      ) : (
        <div className={panelClass("overflow-x-auto")}>
          <table className="min-w-full divide-y divide-line text-sm">
            <thead className="bg-highlight/50 text-left text-xs font-semibold uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-3">Reference</th>
                <th className="px-4 py-3">When</th>
                <th className="px-4 py-3">Client</th>
                <th className="px-4 py-3">Pet</th>
                <th className="px-4 py-3">Amount paid</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((row) => (
                <tr key={row.id}>
                  <td className="px-4 py-3">
                    <Link href={`/staff/pos/${row.id}`} className="font-semibold text-brand hover:underline">
                      {row.reference}
                    </Link>
                  </td>
                  <td className="px-4 py-3">{formatClinicDateTime(row.completed_at ?? row.created_at)}</td>
                  <td className="px-4 py-3">{row.client_name}</td>
                  <td className="px-4 py-3">{row.pet_name ?? "—"}</td>
                  <td className="px-4 py-3">
                    {row.amount_paid === null || row.amount_paid === undefined ? "—" : formatPeso(row.amount_paid)}
                  </td>
                  <td className="px-4 py-3">{POS_STATUS_LABELS[row.status]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
