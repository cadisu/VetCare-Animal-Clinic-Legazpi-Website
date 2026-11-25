import type { Metadata } from "next";
import { SeniorVetProfileForm } from "@/components/senior-vet/SeniorVetProfileForm";
import { DashboardHeading } from "@/components/portal/PlaceholderCard";
import { panelPaddingClass } from "@/components/ui/panel-styles";
import { requireRole } from "@/lib/auth/session";
import { getOwnAvatarUrl } from "@/lib/profile/avatar";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "My Profile" };

export default async function SeniorVetProfilePage() {
  const profile = await requireRole(["SENIOR_VET"]);
  const supabase = await createClient();
  const avatarUrl = await getOwnAvatarUrl(supabase, profile.id);
  const initials = `${profile.first_name.charAt(0)}${profile.last_name.charAt(0)}`.toUpperCase() || "?";

  return (
    <div className="mx-auto max-w-2xl">
      <DashboardHeading title="My Profile" />

      <section className={panelPaddingClass("mb-6")}>
        <dl className="grid gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-muted">Email</dt>
            <dd className="mt-1 break-all text-sm text-ink">{profile.email}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-muted">Role</dt>
            <dd className="mt-1 text-sm text-ink">Senior Vet</dd>
          </div>
        </dl>
        <p className="mt-4 text-xs text-muted">Email, role, and account status cannot be changed here.</p>
      </section>

      <section className={panelPaddingClass("sm:p-8")}>
        <h2 className="mb-6 text-lg font-semibold text-ink">Personal information</h2>
        <SeniorVetProfileForm
          currentImageUrl={avatarUrl}
          initials={initials}
          defaults={{
            lastName: profile.last_name,
            middleName: profile.middle_name ?? "",
            firstName: profile.first_name,
          }}
        />
      </section>
    </div>
  );
}
