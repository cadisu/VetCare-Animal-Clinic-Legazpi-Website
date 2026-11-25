import type { Metadata } from "next";
import { ProfileForm } from "@/components/clients/ProfileForm";
import { DashboardHeading } from "@/components/portal/PlaceholderCard";
import { panelPaddingClass } from "@/components/ui/panel-styles";
import { requireRole } from "@/lib/auth/session";
import { formatDate, todayIso } from "@/lib/dates";

export const metadata: Metadata = { title: "My Profile" };

export default async function ClientProfilePage() {
  const profile = await requireRole(["CLIENT"]);

  return (
    <div className="mx-auto max-w-2xl">
      <DashboardHeading title="My Profile" />

      <section className={panelPaddingClass("mb-6")}>
        <dl className="grid gap-4 sm:grid-cols-3">
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-muted">Email</dt>
            <dd className="mt-1 break-all text-sm text-ink">{profile.email}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-muted">Account status</dt>
            <dd className="mt-1 text-sm text-ink">
              {profile.status === "ACTIVE" ? "Active" : "Inactive"}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-muted">Member since</dt>
            <dd className="mt-1 text-sm text-ink">{formatDate(profile.created_at)}</dd>
          </div>
        </dl>
        <p className="mt-4 text-xs text-muted">
          To change your email, please contact the clinic.
        </p>
      </section>

      <section className={panelPaddingClass("sm:p-8")}>
        <h2 className="mb-6 text-lg font-semibold text-ink">Personal information</h2>
        <ProfileForm
          maxBirthdate={todayIso()}
          defaults={{
            lastName: profile.last_name,
            middleName: profile.middle_name ?? "",
            firstName: profile.first_name,
            nameSuffix: profile.name_suffix ?? "",
            address: profile.address ?? "",
            birthdate: profile.birthdate ?? "",
            contactNumber: profile.contact_number ?? "",
          }}
        />
      </section>
    </div>
  );
}
