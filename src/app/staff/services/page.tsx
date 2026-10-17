import type { Metadata } from "next";
import { ClinicServicesPanel } from "@/components/services/ClinicServicesPanel";
import { requireRole } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Services" };

export default async function StaffServicesPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string }>;
}) {
  await requireRole(["STAFF", "SENIOR_VET"]);
  const editId = (await searchParams).edit;
  return <ClinicServicesPanel editId={editId} />;
}
