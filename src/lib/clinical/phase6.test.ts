import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { groupRevisions } from "@/lib/clinical/constants";
import { clinicalRecordSchema, clinicalReturnPath, parseConsultationWeight, vaccinationSchema, weightSchema } from "@/lib/validation/clinical";

const migration = readFileSync(
  path.join(process.cwd(), "supabase/migrations/20261018000000_phase6_clinical_records.sql"),
  "utf8",
);

const petId = "11111111-1111-4111-8111-111111111111";
const appointmentId = "22222222-2222-4222-8222-222222222222";
const veterinarianId = "33333333-3333-4333-8333-333333333333";

describe("phase 6 migration contract", () => {
  it("lets staff and senior vets record weight, and only senior vets write medical records", () => {
    expect(migration).toMatch(/function public\.record_pet_weight[\s\S]*?'STAFF', 'SENIOR_VET'/);
    expect(migration).toMatch(
      /function public\.create_clinical_record[\s\S]*?is distinct from 'SENIOR_VET'/,
    );
    expect(migration).toMatch(
      /function public\.revise_clinical_record[\s\S]*?is distinct from 'SENIOR_VET'/,
    );
    expect(migration).toMatch(
      /function public\.create_vaccination_record[\s\S]*?is distinct from 'SENIOR_VET'/,
    );
    expect(migration).toMatch(
      /function public\.revise_vaccination_record[\s\S]*?is distinct from 'SENIOR_VET'/,
    );
    expect(migration).toContain("Only Senior Vets can modify this clinical record");
  });

  it("grants select only and keeps client reads on their own pets", () => {
    expect(migration).toContain("grant select on public.pet_weight_records to authenticated");
    expect(migration).toContain("grant select on public.clinical_records to authenticated");
    expect(migration).toContain("grant select on public.vaccination_records to authenticated");
    expect(migration).not.toMatch(/grant (insert|update|delete) on public\.(pet_weight_records|clinical_records|vaccination_records)/);
    expect(migration.match(/p\.owner_id = auth\.uid\(\)/g)?.length).toBe(3);
  });

  it("keeps history by inserting a revision instead of rewriting medical text", () => {
    const clinicalRevise = migration.slice(
      migration.indexOf("function public.revise_clinical_record"),
      migration.indexOf("function public.create_vaccination_record"),
    );
    expect(clinicalRevise).toContain("set is_current = false");
    expect(clinicalRevise).toContain("insert into public.clinical_records");
    expect(clinicalRevise).not.toMatch(/update public\.clinical_records[\s\S]{0,80}clinical_notes/);

    const vaccinationRevise = migration.slice(migration.indexOf("function public.revise_vaccination_record"));
    expect(vaccinationRevise).toContain("set is_current = false");
    expect(vaccinationRevise).toContain("insert into public.vaccination_records");
    expect(vaccinationRevise).not.toMatch(/update public\.vaccination_records[\s\S]{0,80}vaccine_name/);
    expect(migration).toContain("Weight history cannot be modified");
    expect(migration).toContain("(timezone('Asia/Manila', now()))::date");
    expect(migration).not.toContain("p_date > current_date");
  });
});

describe("phase 6 clinic date follow-up", () => {
  const followUp = readFileSync(
    path.join(process.cwd(), "supabase/migrations/20261021000000_phase6_clinic_date.sql"),
    "utf8",
  );

  it("replaces the date check with the Manila clinic date", () => {
    expect(followUp).toContain("create or replace function public.phase6_assert_past_date");
    expect(followUp).toContain("(timezone('Asia/Manila', now()))::date");
    expect(followUp).not.toContain("p_date > current_date");
  });
});

describe("clinical validation", () => {
  it("accepts a manual weight and rejects an out-of-range reading", () => {
    expect(weightSchema.safeParse({ petId, appointmentId: "", weightKg: "4.25" }).success).toBe(true);
    const low = weightSchema.safeParse({ petId, appointmentId: "", weightKg: "0" });
    expect(low.success).toBe(false);
    expect(parseConsultationWeight("")).toEqual({ ok: true, kg: null });
    expect(parseConsultationWeight("12.5")).toEqual({ ok: true, kg: 12.5 });
    expect(parseConsultationWeight("0").ok).toBe(false);
  });

  it("requires the clinical fields a senior vet records", () => {
    const parsed = clinicalRecordSchema.safeParse({
      petId,
      appointmentId,
      lineageId: "",
      visitDate: "2020-01-15",
      veterinarianId,
      reasonForVisit: "Limping",
      clinicalNotes: "Left foreleg sore.",
      assessment: "Soft tissue strain",
      treatment: "Rest and pain relief",
      followUp: "",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.lineageId).toBeNull();
  });

  it("rejects a next vaccination date before the dose", () => {
    const parsed = vaccinationSchema.safeParse({
      petId,
      appointmentId: "",
      lineageId: "",
      vaccineName: "Anti-rabies",
      administeredOn: "2020-01-15",
      dose: "1 ml",
      veterinarianId,
      weightKg: "",
      nextDueOn: "2019-12-01",
      notes: "",
    });
    expect(parsed.success).toBe(false);
  });

  it("keeps return paths inside the clinic portals", () => {
    expect(clinicalReturnPath("/staff/pets/abc?message=1", "/staff")).toBe("/staff/pets/abc");
    expect(clinicalReturnPath("https://example.com", "/staff/pets/abc")).toBe("/staff/pets/abc");
    expect(clinicalReturnPath("/client/pets/abc", "/staff/pets/abc")).toBe("/staff/pets/abc");
  });
});

describe("revision grouping", () => {
  it("shows the current revision and keeps older ones", () => {
    const [group] = groupRevisions([
      { id: "old", lineage_id: "line", revision: 1, is_current: false, note: "first" },
      { id: "new", lineage_id: "line", revision: 2, is_current: true, note: "second" },
    ]);
    expect(group.current.id).toBe("new");
    expect(group.previous.map((row) => row.id)).toEqual(["old"]);
  });
});
