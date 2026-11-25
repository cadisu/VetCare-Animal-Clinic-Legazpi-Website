import { PortalShell } from "@/components/portal/PortalShell";
import { expireUnconfirmedAppointments } from "@/lib/appointments/expire";
import { requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export default async function ClientLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireRole(["CLIENT"]);
  const supabase = await createClient();
  await expireUnconfirmedAppointments(supabase);
  return (
    <PortalShell
      profile={profile}
      nav={[
        { href: "/client", label: "Dashboard", exact: true },
        { href: "/client/appointments", label: "Appointments" },
        { href: "/client/pets", label: "My Pets" },
        { href: "/client/receipts", label: "Receipts" },
        { href: "/client/loyalty", label: "Loyalty" },
        { href: "/client/profile", label: "My Profile" },
      ]}
    >
      {children}
    </PortalShell>
  );
}
