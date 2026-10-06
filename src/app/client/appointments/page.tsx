import type { Metadata } from "next";
import Link from "next/link";
import { AppointmentCard } from "@/components/appointments/AppointmentCard";
import { ClientUpcomingPreview } from "@/components/appointments/ClientUpcomingPreview";
import { DashboardHeading } from "@/components/portal/PlaceholderCard";
import { buttonClass } from "@/components/ui/button-styles";
import { listAppointmentsForClient, splitClientAppointments } from "@/lib/appointments/server";
import { requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "My Appointments" };

export default async function ClientAppointmentsPage() {
  const profile = await requireRole(["CLIENT"]);
  const supabase = await createClient();
  const { upcomingPreview, history } = splitClientAppointments(
    await listAppointmentsForClient(supabase, profile.id),
  );

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <DashboardHeading title="My Appointments" subtitle="Upcoming visits and your booking history." />
        <Link href="/client/appointments/new" className={buttonClass("primary", "md")}>
          Book appointment
        </Link>
      </div>

      <section className="mt-8 space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Upcoming</h2>
        <ClientUpcomingPreview
          appointments={upcomingPreview}
          detailHref={(id) => `/client/appointments/${id}`}
        />
        {upcomingPreview.length === 0 && (
          <Link href="/client/appointments/new" className={buttonClass("outline", "md", "mt-2 inline-flex")}>
            Book an appointment
          </Link>
        )}
      </section>

      <section className="mt-10 space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">History</h2>
        {history.length === 0 ? (
          <p className="text-sm text-slate-600">No past appointments yet.</p>
        ) : (
          <ul className="space-y-3">
            {history.map((a) => (
              <li key={a.id}>
                <AppointmentCard appointment={a} href={`/client/appointments/${a.id}`} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
