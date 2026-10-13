import { SeniorVetShell } from "@/components/senior-vet/SeniorVetShell";
import { requireRole } from "@/lib/auth/session";
import { getOwnAvatarUrl } from "@/lib/profile/avatar";
import { createClient } from "@/lib/supabase/server";

export default async function SeniorVetLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireRole(["SENIOR_VET"]);
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
