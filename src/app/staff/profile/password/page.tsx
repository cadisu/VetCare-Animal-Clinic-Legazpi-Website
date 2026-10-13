import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ChangePasswordForm } from "@/components/senior-vet/ChangePasswordForm";
import { DashboardHeading } from "@/components/portal/PlaceholderCard";
import { panelPaddingClass } from "@/components/ui/panel-styles";
import { requireRole } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Change Password" };

export default async function StaffChangePasswordPage() {
  const profile = await requireRole(["STAFF", "SENIOR_VET"]);
  if (profile.role === "SENIOR_VET") redirect("/senior-vet/profile/password");

  return (
    <div className="mx-auto max-w-xl">
      <DashboardHeading
        title="Change Password"
        subtitle="Confirm your current password, then choose a new one."
      />
      <section className={panelPaddingClass("sm:p-8")}>
        <ChangePasswordForm />
      </section>
    </div>
  );
}
