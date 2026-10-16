import type { Metadata } from "next";
import { AppointmentLogPanel } from "@/components/appointments/AppointmentLogPanel";
import { requireRole } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Appointment history log" };

export default async function StaffAppointmentLogPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string; status?: string; from?: string; to?: string }>;
}) {
  await requireRole(["STAFF", "SENIOR_VET"]);
  const params = await searchParams;

  return <AppointmentLogPanel basePath="/staff/appointments/log" params={params} />;
}
