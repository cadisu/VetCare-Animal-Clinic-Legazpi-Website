import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { canAccessPath } from "@/lib/auth/roles";
import {
  batchExpiryStatus,
  mostUrgentExpiry,
  sellableQuantity,
  stockLevel,
} from "@/lib/inventory/status";
import { inventoryMovementSchema } from "@/lib/validation/inventory";

const migration = readFileSync(
  path.join(process.cwd(), "supabase/migrations/20261026000000_phase8_inventory.sql"),
  "utf8",
);

describe("phase 8 inventory rules", () => {
  it("keeps POS sales on POS_SALE and adds the operational movement types", () => {
    expect(migration).toContain("'POS_SALE', -v_item.qty");
    expect(migration).toContain("'POS_VOID', v_item.qty");
    expect(migration).toContain("perform public.allocate_fefo(v_movement, v_item.product_id, v_item.qty)");
    expect(migration).toContain("perform public.restore_transaction_batches");
    expect(migration).toContain("'STOCK_IN'");
    expect(migration).toContain("'STOCK_OUT'");
    expect(migration).toContain("'DAMAGED'");
    expect(migration).toContain("'MISSING'");
    expect(migration).toContain("'EXPIRED'");
    expect(migration).toContain("product_batch_allocations");
    expect(migration).toContain("expiry_warning_days");
    expect(migration).toContain("This batch is not expired");
    expect(migration).toContain("Enter a reason for this stock change");
    expect(migration).not.toMatch(/pos_complete_transaction[\s\S]{0,2500}'STOCK_OUT'/);
  });

  it("marks zero as out of stock and low stock only while quantity remains", () => {
    expect(stockLevel(0, null)).toBe("OUT");
    expect(stockLevel(0, 5)).toBe("OUT");
    expect(stockLevel(2, 5)).toBe("LOW");
    expect(stockLevel(5, 5)).toBe("LOW");
    expect(stockLevel(6, 5)).toBe("OK");
    expect(stockLevel(2, null)).toBe("OK");
  });

  it("flags each batch from its own expiration date", () => {
    expect(batchExpiryStatus(null, "2026-10-26", 30)).toBe("NORMAL");
    expect(batchExpiryStatus("2026-10-25", "2026-10-26", 30)).toBe("EXPIRED");
    expect(batchExpiryStatus("2026-10-26", "2026-10-26", 30)).toBe("EXPIRING_SOON");
    expect(batchExpiryStatus("2026-11-25", "2026-10-26", 30)).toBe("EXPIRING_SOON");
    expect(batchExpiryStatus("2026-11-26", "2026-10-26", 30)).toBe("NORMAL");
    expect(mostUrgentExpiry(["NORMAL", "EXPIRING_SOON", "EXPIRED"])).toBe("EXPIRED");
    expect(
      sellableQuantity(
        [
          { quantityRemaining: 4, expirationDate: "2026-10-01" },
          { quantityRemaining: 6, expirationDate: "2026-12-01" },
          { quantityRemaining: 2, expirationDate: null },
        ],
        "2026-10-26",
      ),
    ).toBe(8);
  });

  it("requires a reason and keeps clients out of inventory", () => {
    const parsed = inventoryMovementSchema.safeParse({
      productId: "11111111-1111-4111-8111-111111111111",
      movementType: "DAMAGED",
      direction: "OUT",
      quantity: "2",
      batchId: "22222222-2222-4222-8222-222222222222",
      supplier: "",
      referenceNote: "",
      unitCost: "",
      expirationDate: "",
      reason: "Broken bottle",
    });
    expect(parsed.success).toBe(true);
    expect(inventoryMovementSchema.safeParse({
      productId: "11111111-1111-4111-8111-111111111111",
      movementType: "STOCK_IN",
      direction: "",
      quantity: "1",
      batchId: "",
      supplier: "",
      referenceNote: "",
      unitCost: "12.50",
      expirationDate: "2027-01-01",
      reason: "No",
    }).success).toBe(false);
    expect(canAccessPath("CLIENT", "/staff/inventory")).toBe(false);
    expect(canAccessPath("CLIENT", "/staff/inventory/history")).toBe(false);
    expect(canAccessPath("STAFF", "/staff/inventory")).toBe(true);
    expect(canAccessPath("SENIOR_VET", "/staff/inventory/history")).toBe(true);
  });
});
