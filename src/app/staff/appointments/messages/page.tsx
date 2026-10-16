import type { Metadata } from "next";
import { ClinicSmsPanel } from "@/components/appointments/ClinicSmsPanel";

export const metadata: Metadata = { title: "Text messages" };

export default async function ClinicSmsPage({
  searchParams,
}: {
  searchParams: Promise<{ flash?: string; flashError?: string }>;
}) {
  const query = await searchParams;
  return <ClinicSmsPanel homePath="/staff/appointments" flash={query.flash} flashError={query.flashError} />;
}
