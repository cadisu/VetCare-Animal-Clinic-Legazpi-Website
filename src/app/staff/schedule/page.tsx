import type { Metadata } from "next";
import { ClinicSchedulePanel } from "@/components/schedule/ClinicSchedulePanel";
import { requireRole } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Clinic schedule" };

export default async function StaffSchedulePage() {
  await requireRole(["STAFF", "SENIOR_VET"]);
  return <ClinicSchedulePanel />;
}
