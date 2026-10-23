import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  path.join(process.cwd(), "supabase/migrations/20261023000000_phase7_pos_retail.sql"),
  "utf8",
);
const applied = readFileSync(
  path.join(process.cwd(), "supabase/migrations/20261021140000_phase7_pos.sql"),
  "utf8",
);

describe("phase 7 retail migration", () => {
  it("keeps the applied POS migration unchanged and moves retail rules forward", () => {
    expect(applied).toContain("create or replace function public.pos_complete_transaction(p_transaction_id uuid)");
    expect(migration).toContain("drop function if exists public.pos_complete_transaction(uuid)");
    expect(migration).toContain("p_amount_tendered numeric");
    expect(migration).toContain("Amount received is less than the amount due");
    expect(migration).toContain("Enter the customer name");
    expect(migration).toContain("Only Senior Vets can edit a completed transaction");
    expect(migration).toContain("This edit would change the amount paid");
    expect(migration).toContain("'ADJUSTMENT'");
    expect(migration).toContain("'POS_EDIT_RESTORE'");
    expect(migration).toContain('create policy "services_manage_staff"');
    expect(migration).toContain("'product-images'");
    expect(migration).not.toContain("transition_appointment_status");
    expect(migration).toContain("alter table public.pos_transactions alter column client_id drop not null");
  });
});
