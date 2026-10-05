import type { Metadata } from "next";
import { ProfileForm } from "@/components/clients/ProfileForm";
import { DashboardHeading } from "@/components/portal/PlaceholderCard";
import { requireRole } from "@/lib/auth/session";
import { formatDate, todayIso } from "@/lib/dates";

export const metadata: Metadata = { title: "My Profile" };

export default async function ClientProfilePage() {
  const profile = await requireRole(["CLIENT"]);

  return (
    <div className="mx-auto max-w-2xl">
      <DashboardHeading title="My Profile" subtitle="Keep your contact details up to date." />

      <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-6">
        <dl className="grid gap-4 sm:grid-cols-3">
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Email</dt>
            <dd className="mt-1 break-all text-sm text-slate-900">{profile.email}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Account status</dt>
            <dd className="mt-1 text-sm text-slate-900">
              {profile.status === "ACTIVE" ? "Active" : "Inactive"}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Member since</dt>
            <dd className="mt-1 text-sm text-slate-900">{formatDate(profile.created_at)}</dd>
          </div>
        </dl>
        <p className="mt-4 text-xs text-slate-500">
          To change your email, please contact the clinic.
        </p>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">
        <h2 className="mb-6 text-lg font-semibold">Personal information</h2>
        <ProfileForm
          maxBirthdate={todayIso()}
          defaults={{
            lastName: profile.last_name,
            middleName: profile.middle_name ?? "",
            firstName: profile.first_name,
            address: profile.address ?? "",
            birthdate: profile.birthdate ?? "",
            contactNumber: profile.contact_number ?? "",
          }}
        />
      </section>
    </div>
  );
}
