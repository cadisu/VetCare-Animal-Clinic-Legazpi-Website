import type { Metadata } from "next";
import { ClinicSmsPanel } from "@/components/appointments/ClinicSmsPanel";

export const metadata: Metadata = { title: "Text messages" };

export default async function SeniorVetMessagesPage({
  searchParams,
}: {
  searchParams: Promise<{ flash?: string; flashError?: string }>;
}) {
  const query = await searchParams;
  return (
    <ClinicSmsPanel homePath="/senior-vet/appointments" flash={query.flash} flashError={query.flashError} />
  );
}
