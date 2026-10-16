import type { Metadata } from "next";
import Link from "next/link";
import { AppointmentSmsList, type AppointmentSmsRow } from "@/components/appointments/AppointmentSmsList";
import { FlashNotice } from "@/components/appointments/FlashNotice";
import { requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Text messages" };

type ClinicSmsRow = AppointmentSmsRow & {
  appointment_id: string;
  pet_name?: string;
  service_name?: string;
};

export default async function ClinicSmsPage({
  searchParams,
}: {
  searchParams: Promise<{ flash?: string; flashError?: string }>;
}) {
  await requireRole(["STAFF", "SENIOR_VET"]);
  const query = await searchParams;
  const supabase = await createClient();
  const { data } = await supabase.rpc("list_clinic_sms", { p_limit: 50, p_offset: 0 });
  const messages = (Array.isArray(data) ? data : []) as ClinicSmsRow[];

  return (
    <>
      <h2 className="text-lg font-semibold text-ink">Text messages</h2>
      <p className="mt-1 text-sm text-muted">
        Accepted and pending are not the same as sent. Sent means UniSMS reported the message as sent, not that the phone received it.
      </p>
      <FlashNotice flash={query.flash} flashError={query.flashError} />
      <ul className="mt-6 space-y-3">
        {messages.length === 0 ? (
          <li className="text-sm text-muted">No text messages have been recorded.</li>
        ) : (
          messages.map((message) => (
            <li key={message.id} className="rounded-2xl border border-line bg-white p-5">
              <p className="text-sm text-muted">
                <Link href={`/staff/appointments/${message.appointment_id}`} className="font-medium text-brand">
                  {message.pet_name} · {message.service_name}
                </Link>
              </p>
              <AppointmentSmsList messages={[message]} audience="staff" appointmentId={message.appointment_id} />
            </li>
          ))
        )}
      </ul>
    </>
  );
}
