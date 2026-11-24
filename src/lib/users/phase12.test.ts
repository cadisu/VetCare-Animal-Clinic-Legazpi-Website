import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { canAccessPath, getRequiredRoles } from "@/lib/auth/roles";

const migration = readFileSync(
  path.join(process.cwd(), "supabase/migrations/20261124000000_phase12_users_and_audit.sql"),
  "utf8",
);

function body(name: string): string {
  const start = migration.indexOf(`function public.${name}`);
  const next = migration.indexOf("create or replace function public.", start + 1);
  return migration.slice(start, next === -1 ? undefined : next);
}

describe("phase 12 migration contract", () => {
  it("keeps the audit log append-only and free of secrets", () => {
    expect(migration).toContain("grant select on public.audit_logs to authenticated");
    expect(migration).not.toMatch(/grant (insert|update|delete) on public\.audit_logs/);
    expect(migration).toContain("Audit logs cannot be changed");
    expect(migration).not.toMatch(/password/i);
    expect(migration).not.toMatch(/clinical_notes|assessment|treatment/);
    expect(migration).toContain("revoke all on function public.write_audit_log(uuid, text, text, uuid, jsonb) from public, anon, authenticated");
    expect(migration).not.toMatch(/grant execute on function public\.write_audit_log\([\s\S]{0,80}authenticated/);
  });

  it("lets only an active Senior Vet manage accounts", () => {
    for (const name of ["admin_update_profile", "admin_set_account_status", "admin_set_role", "audit_user_created"]) {
      expect(body(name)).toContain("perform public.assert_senior_vet()");
    }
    expect(migration).toContain("public.current_user_role() is distinct from 'SENIOR_VET'");
    expect(migration).toContain("You cannot change your own account status");
    expect(migration).toContain("You cannot change your own role");
    expect(migration).toContain("The clinic must keep at least one active Senior Vet");
    expect(migration).toContain("Client accounts cannot change role");
    expect(body("admin_set_role")).toContain("p_role not in ('STAFF', 'SENIOR_VET')");
  });

  it("records clinical, slot, inventory, loyalty, redemption, and POS actions", () => {
    expect(migration).toContain("create trigger audit_clinical_records");
    expect(migration).toContain("create trigger audit_vaccination_records");
    expect(migration).toContain("create trigger audit_appointment_slots");
    expect(migration).toContain("create trigger audit_appointment_cancellations");
    expect(migration).toContain("create trigger audit_inventory_adjustments");
    expect(migration).toContain("create trigger audit_loyalty_programs");
    expect(migration).toContain("create trigger audit_loyalty_rewards");
    expect(migration).toContain("create trigger audit_loyalty_redemptions");
    expect(migration).toContain("create trigger audit_pos_transactions");
    expect(migration).toContain("new.new_status is distinct from 'CANCELLED'");
    expect(migration).toContain("'ADJUSTMENT', 'STOCK_IN', 'STOCK_OUT', 'DAMAGED', 'MISSING', 'EXPIRED'");
  });
});

describe("phase 12 route gates", () => {
  it("keeps user management and audit logs on the Senior Vet area", () => {
    expect(getRequiredRoles("/senior-vet")).toEqual(["SENIOR_VET"]);
    expect(getRequiredRoles("/senior-vet/users")).toEqual(["SENIOR_VET"]);
    expect(getRequiredRoles("/senior-vet/audit")).toEqual(["SENIOR_VET"]);
    expect(canAccessPath("STAFF", "/senior-vet/users")).toBe(false);
    expect(canAccessPath("CLIENT", "/senior-vet/audit")).toBe(false);
    expect(canAccessPath("SENIOR_VET", "/senior-vet/users")).toBe(true);
  });
});
