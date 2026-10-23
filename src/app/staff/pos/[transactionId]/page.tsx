import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PosNotice } from "@/components/pos/PosNotice";
import { PosReceipt } from "@/components/pos/PosReceipt";
import { buttonClass } from "@/components/ui/button-styles";
import { requireRole } from "@/lib/auth/session";
import { getPosBill, listPosEdits, listSellableProducts, listSellableServices } from "@/lib/pos/server";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Bill" };

export default async function PosBillPage({
  params,
  searchParams,
}: {
  params: Promise<{ transactionId: string }>;
  searchParams: Promise<{ notice?: string; error?: string }>;
}) {
  const profile = await requireRole(["STAFF", "SENIOR_VET"]);
  const { transactionId } = await params;
  const query = await searchParams;
  const supabase = await createClient();
  const bill = await getPosBill(supabase, transactionId);
  if (!bill) notFound();
  if (bill.status === "OPEN") redirect(`/staff/pos?bill=${bill.id}`);

  const [services, products, edits] = await Promise.all([
    listSellableServices(supabase),
    listSellableProducts(supabase),
    listPosEdits(supabase, bill.id),
  ]);

  return (
    <>
      <div className="mb-6">
        <Link href="/staff/pos" className={buttonClass("ghost")}>
          Back to POS
        </Link>
      </div>
      <PosNotice notice={query.notice} error={query.error} />
      <PosReceipt
        bill={bill}
        edits={edits}
        services={services}
        products={products}
        canEditCompleted={profile.role === "SENIOR_VET"}
      />
    </>
  );
}
