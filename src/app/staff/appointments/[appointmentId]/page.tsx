import type { Metadata } from "next";
import { AppointmentDetail } from "@/components/appointments/AppointmentDetail";

export const metadata: Metadata = { title: "Appointment details" };

export default async function StaffAppointmentDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ appointmentId: string }>;
  searchParams: Promise<{ flash?: string; flashError?: string; message?: string; entry?: string; notice?: string; statusError?: string }>;
}) {
  const { appointmentId } = await params;
  const query = await searchParams;
  return (
    <AppointmentDetail
      appointmentId={appointmentId}
      flash={query.flash}
      flashError={query.flashError}
      message={query.message}
      entry={query.entry}
      notice={query.notice}
      statusError={query.statusError}
      homePath="/staff/appointments"
    />
  );
}
