import Link from "next/link";
import { AppointmentSectionNav } from "@/components/senior-vet/AppointmentSectionNav";
import { DashboardHeading } from "@/components/portal/PlaceholderCard";
import { buttonClass } from "@/components/ui/button-styles";
import { requireRole } from "@/lib/auth/session";

export default async function SeniorVetAppointmentsLayout({ children }: { children: React.ReactNode }) {
  await requireRole(["SENIOR_VET"]);

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <DashboardHeading
          title="Appointments"
          subtitle="Today, upcoming visits, and the full appointment record."
        />
        <Link href="/staff/appointments/new?source=WALK_IN" className={buttonClass("primary", "md")}>
          Create Walk-In Appointment
        </Link>
      </div>
      <AppointmentSectionNav />
      <div className="mt-6">{children}</div>
    </>
  );
}
