import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AppointmentBookingSummary } from "@/components/appointments/AppointmentBookingSummary";
import { AppointmentStatusBadge } from "@/components/appointments/AppointmentStatusBadge";
import { DashboardHeading } from "@/components/portal/PlaceholderCard";
import { Alert } from "@/components/ui/Alert";
import { buttonClass } from "@/components/ui/button-styles";
import { formatTime12, SOURCE_LABELS } from "@/lib/appointments/constants";
import { getAppointmentById } from "@/lib/appointments/server";
import { requireRole } from "@/lib/auth/session";
import { formatDate } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Appointment Confirmed" };

export default async function ClientAppointmentConfirmedPage({
  params,
}: {
  params: Promise<{ appointmentId: string }>;
}) {
  const profile = await requireRole(["CLIENT"]);
  const { appointmentId } = await params;
  const supabase = await createClient();
  const appointment = await getAppointmentById(supabase, appointmentId);
  if (!appointment) notFound();
  if (appointment.client_id !== profile.id) redirect("/access-denied");

  const { slot } = appointment;
  const vetAcceptancePending = slot.requires_vet_acceptance && appointment.status === "PENDING";

  const summaryRows = [
    { label: "Pet", value: appointment.pet.name },
    { label: "Service", value: appointment.service.name },
    { label: "Date", value: formatDate(slot.slot_date) },
    { label: "Time", value: formatTime12(slot.start_time) },
    { label: "Source", value: SOURCE_LABELS[appointment.source] },
    ...(slot.veterinarian
      ? [{ label: "Veterinarian", value: slot.veterinarian.display_name }]
      : []),
  ];

  return (
    <>
      <DashboardHeading title="You're booked" />
      <Alert variant="success">
        Your appointment has been saved. The clinic has acknowledged this booking.
      </Alert>
      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h2 className="text-lg font-semibold">{appointment.service.name}</h2>
          <AppointmentStatusBadge status={appointment.status} />
        </div>
        <div className="mt-6">
          <AppointmentBookingSummary rows={summaryRows} vetAcceptancePending={vetAcceptancePending} />
        </div>
        {!vetAcceptancePending && appointment.status === "PENDING" && (
          <p className="mt-4 text-sm text-slate-600">
            Status is Pending until the clinic confirms your visit. You can cancel from the appointment
            details page while it remains Pending.
          </p>
        )}
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/client/appointments/new" className={buttonClass("primary", "md")}>
            Book another appointment
          </Link>
          <Link href={`/client/appointments/${appointment.id}`} className={buttonClass("outline", "md")}>
            View this appointment
          </Link>
          <Link href="/client/appointments" className={buttonClass("ghost", "md")}>
            My appointments
          </Link>
        </div>
      </section>
    </>
  );
}
