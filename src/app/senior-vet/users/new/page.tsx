import type { Metadata } from "next";
import { DashboardHeading } from "@/components/portal/PlaceholderCard";
import { CreatePrivilegedUserForm } from "@/components/users/CreatePrivilegedUserForm";
import { panelPaddingClass } from "@/components/ui/panel-styles";
import { requireRole } from "@/lib/auth/session";

export const metadata: Metadata = { title: "New account" };

export default async function NewPrivilegedUserPage() {
  await requireRole(["SENIOR_VET"]);

  return (
    <>
      <DashboardHeading
        title="New staff account"
        subtitle="Staff and Senior Vet accounts are created here. Public registration still creates client accounts only."
      />
      <section className={panelPaddingClass("max-w-3xl")}>
        <CreatePrivilegedUserForm />
      </section>
    </>
  );
}
