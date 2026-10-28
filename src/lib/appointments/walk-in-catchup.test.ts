import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { isStaffBookableSlot, slotStateLabel } from "@/lib/appointments/constants";

const migration = readFileSync(
  path.join(process.cwd(), "supabase/migrations/20261028120000_same_day_walk_in.sql"),
  "utf8",
);
const loyalty = readFileSync(
  path.join(process.cwd(), "supabase/migrations/20261028120100_staff_loyalty_manage.sql"),
  "utf8",
);

describe("same-day walk-in catch-up", () => {
  it("lets a walk-in use an earlier slot from today and keeps on-behalf bookings on later times", () => {
    expect(isStaffBookableSlot("AVAILABLE", "WALK_IN")).toBe(true);
    expect(isStaffBookableSlot("AVAILABLE", "APPOINTMENT")).toBe(true);
    expect(isStaffBookableSlot("EARLIER_TODAY", "WALK_IN")).toBe(true);
    expect(isStaffBookableSlot("EARLIER_TODAY", "APPOINTMENT")).toBe(false);
    expect(isStaffBookableSlot("UNAVAILABLE", "WALK_IN")).toBe(false);
    expect(isStaffBookableSlot("FULL", "WALK_IN")).toBe(false);
    expect(slotStateLabel("EARLIER_TODAY")).toBe("Earlier today");
  });

  it("returns earlier today only for staff and still closes previous dates", () => {
    expect(migration).toContain("then 'EARLIER_TODAY'");
    expect(migration).toContain("public.current_user_role() in ('STAFF', 'SENIOR_VET')");
    expect(migration).toContain("else 'UNAVAILABLE'");
    expect(migration).toContain("when sl.slot_date < (public.clinic_now())::date then 'UNAVAILABLE'");
    expect(migration).toContain("elsif p_source = 'WALK_IN'");
    expect(migration).toContain("Cannot book a past date for a walk-in");
    expect(migration).toContain("start_time + interval '60 minutes'");
    expect(migration).toContain("'PENDING'");
  });

  it("lets staff and senior vet save the loyalty program", () => {
    expect(loyalty).toContain("public.current_user_role() not in ('STAFF', 'SENIOR_VET')");
    expect(loyalty).toContain("Only clinic staff can change the loyalty program");
  });
});
