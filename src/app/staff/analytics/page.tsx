import type { Metadata } from "next";
import { AnalyticsFilters, AnalyticsReportView, InventoryAnalytics } from "@/components/analytics/AnalyticsReport";
import { DashboardHeading } from "@/components/portal/PlaceholderCard";
import { loadClinicAnalytics } from "@/lib/analytics/server";
import { resolveAnalyticsRange } from "@/lib/analytics/range";
import { requireRole } from "@/lib/auth/session";
import { listInventoryAlerts } from "@/lib/inventory/server";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Analytics" };

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ preset?: string; from?: string; to?: string }>;
}) {
  await requireRole(["STAFF", "SENIOR_VET"]);
  const query = await searchParams;
  const range = resolveAnalyticsRange({ preset: query.preset, from: query.from, to: query.to });
  const supabase = await createClient();
  const alerts = await listInventoryAlerts(supabase);
  const loaded = range.ok ? await loadClinicAnalytics(supabase, range.from, range.to) : null;

  return (
    <>
      <DashboardHeading
        title="Analytics"
        subtitle="Clinic activity for the selected Asia/Manila dates. Inventory alerts below are the current stock, not a historical snapshot."
      />
      <AnalyticsFilters
        preset={range.ok ? range.preset : "custom"}
        from={range.ok ? range.from : (query.from ?? "")}
        to={range.ok ? range.to : (query.to ?? "")}
      />
      {!range.ok ? (
        <section className="rounded-2xl border border-dashed border-line bg-white p-8 text-sm text-muted">{range.message}</section>
      ) : loaded && !loaded.ok ? (
        <section className="rounded-2xl border border-dashed border-line bg-white p-8 text-sm text-muted">{loaded.message}</section>
      ) : loaded && loaded.ok ? (
        <AnalyticsReportView report={loaded.report} />
      ) : null}
      <InventoryAnalytics alerts={alerts} />
    </>
  );
}
