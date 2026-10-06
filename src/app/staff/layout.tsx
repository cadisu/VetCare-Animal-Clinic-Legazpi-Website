import { PortalShell } from "@/components/portal/PortalShell";
import { requireRole } from "@/lib/auth/session";

// Senior Vets have all Staff functions, so they may also enter the Staff area.
export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireRole(["STAFF", "SENIOR_VET"]);
  const nav =
    profile.role === "SENIOR_VET"
      ? [
          { href: "/senior-vet", label: "Senior Vet Dashboard" },
          { href: "/staff", label: "Staff Dashboard", exact: true },
          { href: "/staff/appointments", label: "Appointments" },
          { href: "/staff/clients", label: "Clients" },
        ]
      : [
          { href: "/staff", label: "Dashboard", exact: true },
          { href: "/staff/appointments", label: "Appointments" },
          { href: "/staff/clients", label: "Clients" },
        ];

  return (
    <PortalShell profile={profile} nav={nav}>
      {children}
    </PortalShell>
  );
}
