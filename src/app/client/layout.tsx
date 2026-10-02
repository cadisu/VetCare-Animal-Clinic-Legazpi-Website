import { PortalShell } from "@/components/portal/PortalShell";
import { requireRole } from "@/lib/auth/session";

export default async function ClientLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireRole(["CLIENT"]);
  return (
    <PortalShell profile={profile} nav={[{ href: "/client", label: "Dashboard" }]}>
      {children}
    </PortalShell>
  );
}
