import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { canAccessPath } from "@/lib/auth/roles";
import {
  countAfterRedemption,
  grantExpiresAt,
  nextMilestone,
  placeStamp,
  previewReward,
  stampSlots,
  stampsRemaining,
} from "@/lib/loyalty/card";

const migration = readFileSync(
  path.join(process.cwd(), "supabase/migrations/20261028000000_phase9_loyalty.sql"),
  "utf8",
);
const phase7 = readFileSync(
  path.join(process.cwd(), "supabase/migrations/20261021140000_phase7_pos.sql"),
  "utf8",
);
const phase8 = readFileSync(
  path.join(process.cwd(), "supabase/migrations/20261026000000_phase8_inventory.sql"),
  "utf8",
);
const actions = readFileSync(path.join(process.cwd(), "src/app/actions/pos.ts"), "utf8");
const loyaltyActions = readFileSync(path.join(process.cwd(), "src/app/actions/loyalty.ts"), "utf8");
const seniorNav = readFileSync(path.join(process.cwd(), "src/components/senior-vet/nav.ts"), "utf8");
const staffNav = readFileSync(path.join(process.cwd(), "src/components/staff/nav.ts"), "utf8");
const clientLayout = readFileSync(path.join(process.cwd(), "src/app/client/layout.tsx"), "utf8");

function functionBody(name: string): string {
  const match = migration.match(new RegExp(`function public\\.${name}[\\s\\S]*?\\$fn\\$;`));
  return match?.[0] ?? "";
}

describe("phase 9 stamp rules", () => {
  it("awards one stamp only after a paid completed eligible visit", () => {
    const award = functionBody("loyalty_award_for_transaction");
    expect(award).toContain("v_txn.status <> 'COMPLETED'");
    expect(award).toContain("v_txn.client_id is null");
    expect(award).toContain("loyalty_qualifying_service");
    expect(award).toContain("event_type = 'EARNED'");
    expect(award).toContain("status = 'ACTIVE'");
    expect(migration).toContain("a.status = 'COMPLETED'");
    expect(migration).toContain("i.item_type = 'SERVICE'");
    expect(migration).toContain("loyalty_stamp_one_active_earn");
    expect(migration).not.toContain("allocate_fefo");
    expect(migration).not.toContain("create or replace function public.pos_complete_transaction");
    expect(migration).not.toContain("create or replace function public.pos_void_transaction");
    expect(migration).not.toContain("create or replace function public.pos_edit_completed_transaction");
  });

  it("reverses a voided stamp and restores a redemption without deleting history", () => {
    expect(functionBody("loyalty_on_completed_void")).toContain("loyalty_reverse_stamp");
    expect(functionBody("loyalty_on_completed_void")).toContain("loyalty_restore_redemption");
    expect(functionBody("loyalty_reverse_stamp")).toContain("'REVERSED'");
    expect(functionBody("loyalty_restore_redemption")).toContain("status = 'RESTORED'");
    expect(migration).toContain("Loyalty history cannot be deleted");
    expect(functionBody("loyalty_release_hold")).not.toContain("loyalty_redemptions");
    expect(migration).toContain("old.status = 'OPEN' and new.status = 'VOIDED'");
  });

  it("keeps phase 7 and phase 8 payment and stock rules in their own files", () => {
    expect(phase7).toContain("reward_amount = 0");
    expect(phase7).toContain("discount_amount = 0");
    expect(phase8).toContain("perform public.allocate_fefo(v_movement, v_item.product_id, v_item.qty)");
    expect(phase8).toContain("perform public.restore_transaction_batches");
    expect(actions).toContain("pos_save_cart");
    expect(actions).toContain("pos_save_cart_with_reward");
    expect(actions).not.toContain("p_total");
    expect(actions).not.toContain("p_unit_price");
  });
});

describe("phase 9 cycles, holds, and grant snapshots", () => {
  it("resets on redemption and stops a full card until the next cycle", () => {
    expect(migration).toContain("cycle_policy = 'RESET_ON_REDEEM'");
    expect(migration).toContain("v_count >= v_program.stamp_limit");
    expect(migration).toContain("if v_program.cycle_policy = 'RESET_ON_REDEEM' then");
    expect(placeStamp("RESET_ON_REDEEM", 11, 12)).toEqual({ awarded: true, count: 12, rolledOver: false });
    expect(placeStamp("RESET_ON_REDEEM", 12, 12)).toEqual({ awarded: false, count: 12, rolledOver: false });
    expect(countAfterRedemption("RESET_ON_REDEEM", 12)).toBe(0);
  });

  it("continues after redemption and rolls a full card into stamp 1", () => {
    expect(migration).toContain("CONTINUE: the stamp that would pass stamp_limit");
    expect(migration).toContain("'ROLLOVER'");
    expect(placeStamp("CONTINUE", 12, 12)).toEqual({ awarded: true, count: 1, rolledOver: true });
    expect(countAfterRedemption("CONTINUE", 12)).toBe(12);
    expect(placeStamp("CONTINUE", 8, 12)).toEqual({ awarded: true, count: 9, rolledOver: false });
  });

  it("reserves a reward on an open bill and detaches it without a redemption", () => {
    expect(migration).toContain("held_by_transaction_id");
    expect(migration).toContain("loyalty_grants_one_hold");
    expect(functionBody("loyalty_attach_reward")).toContain("p_grant_id is null");
    expect(functionBody("loyalty_attach_reward")).toContain("loyalty_release_hold");
    expect(functionBody("loyalty_attach_reward")).toContain("This reward is on another open bill");
    expect(migration).toContain("Reservation on one open bill");
  });

  it("copies expires_at onto the grant and refuses later validity edits", () => {
    expect(functionBody("loyalty_unlock_cycle")).toContain("make_interval(days => v_reward.validity_days)");
    expect(migration).toContain("Existing reward validity cannot be changed");
    expect(functionBody("loyalty_save_reward")).toContain("Raising a milestone does not revoke grants already issued");
    const unlocked = new Date("2026-01-01T00:00:00.000Z");
    const original = grantExpiresAt(unlocked, 30);
    const edited = grantExpiresAt(unlocked, 90);
    expect(original?.toISOString()).toBe("2026-01-31T00:00:00.000Z");
    expect(edited?.toISOString()).not.toBe(original?.toISOString());
    expect(grantExpiresAt(unlocked, null)).toBeNull();
  });

  it("defaults to 12 stamps and keeps configuration on the server", () => {
    expect(migration).toContain("stamp_limit   int not null default 12");
    expect(migration).toContain("'VetCare Loyalty'");
    expect(functionBody("loyalty_save_program")).toContain("loyalty_assert_senior");
    expect(functionBody("loyalty_save_reward")).toContain("loyalty_assert_senior");
    expect(functionBody("loyalty_attach_reward")).toContain("pos_assert_staff");
    expect(migration).toContain("grant select on public.loyalty_grants to authenticated");
    expect(migration).not.toContain("grant insert on public.loyalty_grants");
    expect(migration).not.toContain("grant update on public.loyalty_grants");
    expect(loyaltyActions).toContain('requireRole(["STAFF", "SENIOR_VET"])');
    expect(loyaltyActions).not.toContain('requireRole(["CLIENT"])');
    expect(loyaltyActions).not.toContain('requireRole(["SENIOR_VET"])');
  });
});

describe("phase 9 card display and access", () => {
  it("draws a partial card and the stamps left to the next milestone", () => {
    expect(stampSlots(8, 12).filter(Boolean)).toHaveLength(8);
    expect(stampSlots(8, 12)).toHaveLength(12);
    expect(stampSlots(0, 12).some(Boolean)).toBe(false);
    expect(nextMilestone(8, [8, 10, 12], 12)).toBe(10);
    expect(stampsRemaining(8, [8, 10, 12], 12)).toBe(2);
    expect(stampsRemaining(12, [8, 10, 12], 12)).toBe(0);
    expect(nextMilestone(12, [8, 10, 12], 12)).toBeNull();
  });

  it("previews one free unit and an authoritative discount cap", () => {
    expect(previewReward({
      type: "FREE_SERVICE",
      discountAmount: null,
      serviceId: "groom",
      lines: [
        { itemType: "SERVICE", serviceId: "groom", unitPrice: 500, quantity: 3 },
        { itemType: "PRODUCT", serviceId: null, unitPrice: 100, quantity: 1 },
      ],
    })).toBe(500);
    expect(previewReward({
      type: "FREE_SERVICE",
      discountAmount: null,
      serviceId: "missing",
      lines: [{ itemType: "PRODUCT", serviceId: null, unitPrice: 100, quantity: 1 }],
    })).toBeNull();
    expect(previewReward({
      type: "DISCOUNT",
      discountAmount: 200,
      serviceId: null,
      lines: [{ itemType: "SERVICE", serviceId: "consult", unitPrice: 150, quantity: 1 }],
    })).toBe(150);
    expect(previewReward({
      type: "DISCOUNT",
      discountAmount: 200,
      serviceId: "deworm",
      lines: [{ itemType: "SERVICE", serviceId: "deworm", unitPrice: 350, quantity: 1 }],
    })).toBe(200);
  });

  it("lets a client open their card and lets staff manage the program", () => {
    expect(clientLayout).toContain('href: "/client/loyalty"');
    expect(seniorNav).toContain('href: "/staff/loyalty"');
    expect(staffNav).toContain('href: "/staff/loyalty"');
    expect(staffNav).not.toContain("/senior-vet/loyalty");
    expect(canAccessPath("CLIENT", "/client/loyalty")).toBe(true);
    expect(canAccessPath("CLIENT", "/staff/loyalty")).toBe(false);
    expect(canAccessPath("CLIENT", "/senior-vet/loyalty")).toBe(false);
    expect(canAccessPath("STAFF", "/senior-vet/loyalty")).toBe(false);
    expect(canAccessPath("STAFF", "/staff/loyalty")).toBe(true);
    expect(canAccessPath("SENIOR_VET", "/staff/loyalty")).toBe(true);
  });
});
