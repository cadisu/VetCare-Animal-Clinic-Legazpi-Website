"use client";

import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { SENIOR_VET_NAV, type SeniorVetShellProfile } from "./nav";

const COLLAPSE_KEY = "vetcare.seniorVet.sidebarCollapsed";

export function SeniorVetShell({
  profile,
  children,
}: {
  profile: SeniorVetShellProfile;
  children: React.ReactNode;
}) {
  return (
    <DashboardShell
      profile={profile}
      nav={SENIOR_VET_NAV}
      homeHref="/senior-vet"
      navLabel="Senior Vet"
      roleLabel="Senior Vet"
      profileHref="/senior-vet/profile"
      passwordHref="/senior-vet/profile/password"
      collapseStorageKey={COLLAPSE_KEY}
      mobileMenuLabel="Senior Vet menu"
    >
      {children}
    </DashboardShell>
  );
}
