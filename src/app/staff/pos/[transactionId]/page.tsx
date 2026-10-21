import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PosCheckout } from "@/components/pos/PosCheckout";
import { PosNotice } from "@/components/pos/PosNotice";
import { buttonClass } from "@/components/ui/button-styles";
import { requireRole } from "@/lib/auth/session";
import {
  appointmentServicePrice,
  getPosBill,
  listBilledServiceIds,
  listSellableProducts,
  listSellableServices,
} from "@/lib/pos/server";
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

  const [services, products, billedServiceIds, visitService] = await Promise.all([
    listSellableServices(supabase),
    listSellableProducts(supabase),
    bill.appointment_id ? listBilledServiceIds(supabase, bill.appointment_id) : Promise.resolve([]),
    bill.appointment_id ? appointmentServicePrice(supabase, bill.appointment_id) : Promise.resolve(null),
  ]);
  const visitServiceNeedsPrice = Boolean(
    visitService &&
      (visitService.price === null || visitService.price === "") &&
      !billedServiceIds.includes(visitService.id),
  );

  return (
    <>
      <div className="mb-6">
        <Link href="/staff/pos" className={buttonClass("ghost")}>
          Back to POS
        </Link>
      </div>
      <PosNotice notice={query.notice} error={query.error} />
      <PosCheckout
        bill={bill}
        services={services}
        products={products}
        billedServiceIds={billedServiceIds}
        visitServiceNeedsPrice={visitServiceNeedsPrice}
        canVoidCompleted={profile.role === "SENIOR_VET"}
      />
    </>
  );
}
