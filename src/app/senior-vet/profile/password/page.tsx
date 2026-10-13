import type { Metadata } from "next";
import { ChangePasswordForm } from "@/components/senior-vet/ChangePasswordForm";
import { DashboardHeading } from "@/components/portal/PlaceholderCard";
import { requireRole } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Change Password" };

export default async function SeniorVetChangePasswordPage() {
  await requireRole(["SENIOR_VET"]);

  return (
    <div className="mx-auto max-w-xl">
      <DashboardHeading
        title="Change Password"
        subtitle="Confirm your current password, then choose a new one."
      />
      <section className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">
        <ChangePasswordForm />
      </section>
    </div>
  );
}
