import { PortalShell } from "@/components/portal/PortalShell";
import { requireRole } from "@/lib/auth/session";

export default async function SeniorVetLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireRole(["SENIOR_VET"]);
  return (
    <PortalShell
      profile={profile}
      nav={[
        { href: "/senior-vet", label: "Senior Vet Dashboard" },
        { href: "/staff", label: "Staff Dashboard", exact: true },
        { href: "/staff/clients", label: "Clients" },
      ]}
    >
      {children}
    </PortalShell>
  );
}
