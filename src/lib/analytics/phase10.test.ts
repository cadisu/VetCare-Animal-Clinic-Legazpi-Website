import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { APPOINTMENT_STATUSES, type AppointmentStatus } from "@/lib/appointments/constants";
import { canAccessPath } from "@/lib/auth/roles";
import {
  appointmentStatusTotal,
  countsAsCompletedSale,
  countsAsNetStamp,
  countsAsRegisteredCustomer,
  countsAsRewardRedemption,
  countsAsRewardUnlock,
  countsAsStampReversal,
  isCounterBillWithoutClient,
  isWalkInAppointment,
  RECORDED_SALES_LABEL,
  serviceRollup,
  zeroFillSalesDays,
} from "@/lib/analytics/metrics";
import { batchExpiryStatus, stockLevel } from "@/lib/inventory/status";
import { lineSubtotal } from "@/lib/pos/money";

const root = process.cwd();
const migration = readFileSync(path.join(root, "supabase/migrations/20261029000000_phase10_analytics.sql"), "utf8");
const page = readFileSync(path.join(root, "src/app/staff/analytics/page.tsx"), "utf8");
const view = readFileSync(path.join(root, "src/components/analytics/AnalyticsReport.tsx"), "utf8");
const staffNav = readFileSync(path.join(root, "src/components/staff/nav.ts"), "utf8");
const seniorNav = readFileSync(path.join(root, "src/components/senior-vet/nav.ts"), "utf8");
const inventoryServer = readFileSync(path.join(root, "src/lib/inventory/server.ts"), "utf8");

function reportFunction(): string {
  const match = migration.match(/function public\.clinic_analytics_report[\s\S]*?\$fn\$;/);
  return match?.[0] ?? "";
}

describe("phase 10 analytics report", () => {
  const report = reportFunction();

  it("stays read-only and grants execution only to authenticated staff roles", () => {
    expect(report).not.toMatch(/\b(insert|update|delete)\b/i);
    expect(report).not.toContain("record_inventory_movement");
    expect(report).not.toContain("allocate_fefo");
    expect(report).not.toContain("loyalty_award_for_transaction");
    expect(report).not.toContain("pos_complete_transaction");
    expect(report).toContain("public.current_user_role()");
    expect(report).toContain("v_role not in ('STAFF', 'SENIOR_VET')");
    expect(report).not.toContain("p_role");
    expect(migration).toContain("revoke all on function public.clinic_analytics_report(date, date) from public, anon;");
    expect(migration).toContain("grant execute on function public.clinic_analytics_report(date, date) to authenticated;");
    expect(page).toContain('requireRole(["STAFF", "SENIOR_VET"])');
    expect(page).toContain("listInventoryAlerts");
    expect(inventoryServer).toContain("export async function listInventoryAlerts");
    expect(staffNav).toContain('href: "/staff/analytics"');
    expect(seniorNav).toContain('href: "/staff/analytics"');
    expect(canAccessPath("STAFF", "/staff/analytics")).toBe(true);
    expect(canAccessPath("SENIOR_VET", "/staff/analytics")).toBe(true);
    expect(canAccessPath("CLIENT", "/staff/analytics")).toBe(false);
    expect(canAccessPath("CLIENT", "/senior-vet")).toBe(false);
  });

  it("counts client registrations, scheduled visits, and bookings separately", () => {
    expect(countsAsRegisteredCustomer("CLIENT")).toBe(true);
    expect(countsAsRegisteredCustomer("STAFF")).toBe(false);
    expect(report).toContain("role = 'CLIENT'");
    expect(report).toContain("s.slot_date between p_from and p_to");
    expect(report).toContain("from public.appointments\n  where (timezone('Asia/Manila', created_at))::date between p_from and p_to");
    for (const status of APPOINTMENT_STATUSES) {
      expect(report).toContain(`a.status = '${status}'`);
    }
    expect(report).toContain("Appointment status counts do not reconcile");
    const counts = {
      PENDING: 1,
      CONFIRMED: 2,
      CHECKED_IN: 0,
      IN_CONSULTATION: 1,
      COMPLETED: 3,
      CANCELLED: 1,
      NO_SHOW: 1,
    } satisfies Record<AppointmentStatus, number>;
    expect(appointmentStatusTotal(counts)).toBe(9);
    counts.CONFIRMED = 4;
    expect(appointmentStatusTotal(counts)).toBe(11);
  });

  it("classifies walk-in appointments separately from counter bills", () => {
    expect(isWalkInAppointment("WALK_IN")).toBe(true);
    expect(isWalkInAppointment("APPOINTMENT")).toBe(false);
    expect(isCounterBillWithoutClient(null)).toBe(true);
    expect(isCounterBillWithoutClient("client-id")).toBe(false);
    expect(report).toContain("a.source = 'WALK_IN'");
    expect(report).toContain("a.source = 'APPOINTMENT'");
    expect(report).toContain("client_id is null");
  });

  it("counts a service once per completed bill and sums stored line subtotals", () => {
    expect(lineSubtotal(150.5, 2)).toBe(301);
    const bills = [
      {
        id: "open",
        status: "OPEN",
        lines: [{ serviceId: "consult", subtotal: lineSubtotal(500, 1) }],
      },
      {
        id: "paid",
        status: "COMPLETED",
        lines: [
          { serviceId: "consult", subtotal: 500 },
          { serviceId: "consult", subtotal: 200 },
          { serviceId: "groom", subtotal: 350 },
        ],
      },
      {
        id: "voided",
        status: "VOIDED",
        lines: [{ serviceId: "consult", subtotal: 500 }],
      },
    ];
    expect(serviceRollup(bills, "consult")).toEqual({ transactions: 1, recordedAmount: 700 });
    expect(serviceRollup(bills, "groom")).toEqual({ transactions: 1, recordedAmount: 350 });
    expect(report).toContain("i.item_type = 'SERVICE'");
    expect(report).toContain("count(distinct i.transaction_id)");
    expect(report).toContain("sum(i.subtotal)");
    expect(report).not.toContain("unit_price *");
    expect(report).toContain("t.status = 'COMPLETED'");
    expect(report).toContain("t.completed_at is not null");
  });

  it("keeps open and voided bills out of recorded sales and fills quiet days", () => {
    expect(countsAsCompletedSale("COMPLETED")).toBe(true);
    expect(countsAsCompletedSale("OPEN")).toBe(false);
    expect(countsAsCompletedSale("VOIDED")).toBe(false);
    expect(report).toContain("status = 'COMPLETED'");
    expect(report).toContain("(timezone('Asia/Manila', completed_at))::date between p_from and p_to");
    expect(report).not.toContain("'OPEN'");
    expect(report).not.toContain("'VOIDED'");
    expect(report).toContain("sum(subtotal)");
    expect(report).toContain("sum(discount_amount)");
    expect(report).toContain("sum(reward_amount)");
    expect(report).toContain("sum(total)");
    expect(report).toContain("generate_series(p_from, p_to, interval '1 day')");
    expect(report).toContain("coalesce(sales.recorded_sales, 0)");
    expect(RECORDED_SALES_LABEL).toBe("Recorded sales");
    expect(view).toContain("RECORDED_SALES_LABEL");
    expect(view).not.toMatch(/profit/i);
    const days = zeroFillSalesDays("2026-10-01", "2026-10-03", [
      { date: "2026-10-02", gross: 100, discounts: 0, rewards: 20, recordedSales: 80, transactions: 1 },
    ]);
    expect(days).toEqual([
      { date: "2026-10-01", gross: 0, discounts: 0, rewards: 0, recordedSales: 0, transactions: 0 },
      { date: "2026-10-02", gross: 100, discounts: 0, rewards: 20, recordedSales: 80, transactions: 1 },
      { date: "2026-10-03", gross: 0, discounts: 0, rewards: 0, recordedSales: 0, transactions: 0 },
    ]);
  });

  it("excludes reversed stamps, revoked grants, and restored redemptions from the net counts", () => {
    expect(countsAsNetStamp({ eventType: "EARNED", status: "ACTIVE" })).toBe(true);
    expect(countsAsNetStamp({ eventType: "EARNED", status: "REVERSED" })).toBe(false);
    expect(countsAsStampReversal({ eventType: "REVERSED" })).toBe(true);
    expect(countsAsRewardUnlock("AVAILABLE")).toBe(true);
    expect(countsAsRewardUnlock("REDEEMED")).toBe(true);
    expect(countsAsRewardUnlock("REVOKED")).toBe(false);
    expect(countsAsRewardRedemption("APPLIED")).toBe(true);
    expect(countsAsRewardRedemption("RESTORED")).toBe(false);
    expect(report).toContain("event_type = 'EARNED'");
    expect(report).toContain("status = 'ACTIVE'");
    expect(report).toContain("event_type = 'REVERSED'");
    expect(report).toContain("status <> 'REVOKED'");
    expect(report).toContain("status = 'REVOKED'");
    expect(report).toContain("status = 'APPLIED'");
    expect(report).toContain("status = 'RESTORED'");
  });

  it("uses the existing inventory alert definitions for current stock", () => {
    expect(stockLevel(0, 5)).toBe("OUT");
    expect(stockLevel(2, 5)).toBe("LOW");
    expect(stockLevel(6, 5)).toBe("OK");
    expect(batchExpiryStatus("2026-10-01", "2026-10-29", 30)).toBe("EXPIRED");
    expect(batchExpiryStatus("2026-11-15", "2026-10-29", 30)).toBe("EXPIRING_SOON");
    expect(batchExpiryStatus("2026-12-31", "2026-10-29", 30)).toBe("NORMAL");
    expect(view).toContain("Current inventory alerts");
    expect(page).not.toContain("record_inventory_movement");
  });
});
