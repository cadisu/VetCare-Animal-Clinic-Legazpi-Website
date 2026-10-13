import { PortalShell } from "@/components/portal/PortalShell";
import { SeniorVetShell } from "@/components/senior-vet/SeniorVetShell";
import { requireRole } from "@/lib/auth/session";
import { getOwnAvatarUrl } from "@/lib/profile/avatar";
import { createClient } from "@/lib/supabase/server";

// Senior Vets have all Staff functions, so they may also enter the Staff area.
// They keep the Senior Vet sidebar. Staff keep the existing top navigation.
export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireRole(["STAFF", "SENIOR_VET"]);

  if (profile.role === "SENIOR_VET") {
    const supabase = await createClient();
    const avatarUrl = await getOwnAvatarUrl(supabase, profile.id);
    return (
      <SeniorVetShell
        profile={{
          fullName: profile.full_name,
          email: profile.email,
          firstName: profile.first_name,
          lastName: profile.last_name,
          avatarUrl,
        }}
      >
        {children}
      </SeniorVetShell>
    );
  }

  return (
    <PortalShell
      profile={profile}
      nav={[
        { href: "/staff", label: "Dashboard", exact: true },
        { href: "/staff/appointments", label: "Appointments" },
        { href: "/staff/clients", label: "Clients" },
      ]}
    >
      {children}
    </PortalShell>
  );
}
