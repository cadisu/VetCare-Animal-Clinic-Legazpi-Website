import type { Metadata } from "next";
import { RescheduleRequestsPanel } from "@/components/appointments/RescheduleRequestsPanel";

export const metadata: Metadata = { title: "Reschedule requests" };

export default async function RescheduleRequestsPage({
  searchParams,
}: {
  searchParams: Promise<{ flash?: string; flashError?: string }>;
}) {
  const query = await searchParams;
  return (
    <RescheduleRequestsPanel
      homePath="/staff/appointments"
      flash={query.flash}
      flashError={query.flashError}
    />
  );
}
