import { SeniorVetShell } from "@/components/senior-vet/SeniorVetShell";
import { StaffShell } from "@/components/staff/StaffShell";
import { expireUnconfirmedAppointments } from "@/lib/appointments/expire";
import { requireRole } from "@/lib/auth/session";
import { getOwnAvatarUrl } from "@/lib/profile/avatar";
import { createClient } from "@/lib/supabase/server";

// Senior Vets have all Staff functions, so they may also enter the Staff area.
// They keep the Senior Vet sidebar. Staff use the same sidebar pattern with Staff-only nav.
export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireRole(["STAFF", "SENIOR_VET"]);
  const supabase = await createClient();
  await expireUnconfirmedAppointments(supabase);
  const avatarUrl = await getOwnAvatarUrl(supabase, profile.id);
  const shellProfile = {
    fullName: profile.full_name,
    email: profile.email,
    firstName: profile.first_name,
    lastName: profile.last_name,
    avatarUrl,
  };

  if (profile.role === "SENIOR_VET") {
    return <SeniorVetShell profile={shellProfile}>{children}</SeniorVetShell>;
  }

  return <StaffShell profile={shellProfile}>{children}</StaffShell>;
}
