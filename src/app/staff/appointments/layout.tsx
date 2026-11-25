import Link from "next/link";
import { StaffAppointmentSectionNav } from "@/components/staff/StaffAppointmentSectionNav";
import { DashboardHeading } from "@/components/portal/PlaceholderCard";
import { buttonClass } from "@/components/ui/button-styles";
import { requireRole } from "@/lib/auth/session";

export default async function StaffAppointmentsLayout({ children }: { children: React.ReactNode }) {
  await requireRole(["STAFF", "SENIOR_VET"]);

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <DashboardHeading title="Appointments" />
        <div className="flex flex-wrap gap-2">
          <Link href="/staff/appointments/new" className={buttonClass("primary", "md")}>
            Walk-in / book
          </Link>
          <Link href="/staff/appointments/slots" className={buttonClass("outline", "md")}>
            Manage slots
          </Link>
        </div>
      </div>
      <StaffAppointmentSectionNav />
      <div className="mt-6">{children}</div>
    </>
  );
}
