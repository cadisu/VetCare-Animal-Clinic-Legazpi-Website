import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { canAccessPath } from "@/lib/auth/roles";
import { cashChange, lineSubtotal, transactionTotals } from "@/lib/pos/money";
import { canBillAppointment, paymentLabel } from "@/lib/pos/status";
import { posReturnPath, productSchema, quantitySchema } from "@/lib/validation/pos";

const migration = readFileSync(
  path.join(process.cwd(), "supabase/migrations/20261021140000_phase7_pos.sql"),
  "utf8",
);
const actions = readFileSync(path.join(process.cwd(), "src/app/actions/pos.ts"), "utf8");

describe("phase 7 migration contract", () => {
  it("lets staff and senior vets sell, and only a senior vet voids a completed bill or edits products", () => {
    expect(migration).toMatch(/function public\.pos_assert_staff[\s\S]*?'STAFF', 'SENIOR_VET'/);
    expect(migration).toMatch(/function public\.pos_complete_transaction[\s\S]*?perform public\.pos_assert_staff\(\)/);
    expect(migration).toContain("Only Senior Vets can void a completed transaction");
    expect(migration).toContain("Only Senior Vets can manage products");
    expect(migration).toContain("public.current_user_role() in ('STAFF', 'SENIOR_VET')");
    expect(migration).not.toMatch(/grant (insert|update|delete) on public\.pos_transactions/);
    expect(migration).not.toMatch(/grant (insert|update|delete) on public\.products/);
  });

  it("keeps payment, stock, and appointment completion apart", () => {
    expect(migration).toContain("amount_paid = v_total");
    expect(migration).toContain("'POS_SALE', -v_item.qty");
    expect(migration).toContain("'POS_VOID', v_item.qty");
    expect(migration).toContain("This service is already on a bill for this visit");
    expect(migration).toContain("Completed transactions cannot be deleted");
    expect(migration).toContain("discount_amount = 0");
    expect(migration).toContain("reward_amount = 0");
    expect(migration).not.toContain("transition_appointment_status");
    expect(migration).not.toContain("update public.appointments");
  });

  it("does not trust a unit price or total sent by the browser", () => {
    expect(actions).toContain("pos_save_cart");
    expect(actions).toContain("p_amount_tendered");
    expect(actions).not.toContain("p_total");
    expect(actions).not.toContain("p_unit_price");
  });
});

describe("phase 7 totals and visit payment", () => {
  it("calculates line subtotals and keeps discount and reward at zero", () => {
    expect(lineSubtotal(199.99, 2)).toBe(399.98);
    expect(lineSubtotal(19.99, 3)).toBe(59.97);
    expect(cashChange(150.5, 200)).toBe(49.5);
    expect(cashChange(100, 99.99)).toBeNull();
    expect(transactionTotals([100, 50.5])).toEqual({
      subtotal: 150.5,
      discount: 0,
      reward: 0,
      total: 150.5,
    });
    expect(transactionTotals([])).toEqual({ subtotal: 0, discount: 0, reward: 0, total: 0 });
  });

  it("labels a visit from its bills without turning payment into the appointment status", () => {
    expect(paymentLabel([])).toBe("No bill");
    expect(paymentLabel(["OPEN"])).toBe("Open bill");
    expect(paymentLabel(["COMPLETED"])).toBe("Paid");
    expect(paymentLabel(["VOIDED"])).toBe("Voided");
    expect(paymentLabel(["COMPLETED", "OPEN"])).toBe("Open bill");
    expect(paymentLabel(["VOIDED", "COMPLETED"])).toBe("Paid");
  });

  it("bills a visit only once it is in consultation or already completed", () => {
    expect(canBillAppointment("IN_CONSULTATION")).toBe(true);
    expect(canBillAppointment("COMPLETED")).toBe(true);
    expect(canBillAppointment("CHECKED_IN")).toBe(false);
    expect(canBillAppointment("CONFIRMED")).toBe(false);
    expect(canBillAppointment("CANCELLED")).toBe(false);
    expect(canBillAppointment("NO_SHOW")).toBe(false);
  });

  it("keeps clients out of the staff POS and rejects outside return paths", () => {
    expect(canAccessPath("CLIENT", "/staff/pos")).toBe(false);
    expect(canAccessPath("CLIENT", "/staff/pos/history")).toBe(false);
    expect(canAccessPath("STAFF", "/staff/pos")).toBe(true);
    expect(canAccessPath("SENIOR_VET", "/staff/products")).toBe(true);
    expect(posReturnPath("/staff/appointments/abc", "/staff/pos")).toBe("/staff/appointments/abc");
    expect(posReturnPath("https://example.com", "/staff/pos")).toBe("/staff/pos");
    expect(posReturnPath("//evil.example", "/staff/pos")).toBe("/staff/pos");
    expect(posReturnPath("/client/pets", "/staff/pos")).toBe("/staff/pos");
  });

  it("accepts a product price and a sale quantity", () => {
    const parsed = productSchema.safeParse({
      name: "Pet shampoo",
      category: "Supply",
      unit: "bottle",
      price: "150.50",
      quantityOnHand: "20",
      minimumStock: "",
      isActive: "true",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.price).toBe(150.5);
      expect(parsed.data.isActive).toBe(true);
    }
    expect(productSchema.safeParse({
      name: "",
      category: "Supply",
      unit: "bottle",
      price: "10",
      quantityOnHand: "1",
      isActive: "true",
    }).success).toBe(false);
    expect(quantitySchema.safeParse("2").success).toBe(true);
    expect(quantitySchema.safeParse("0").success).toBe(false);
    expect(quantitySchema.safeParse("1.5").success).toBe(false);
  });
});
