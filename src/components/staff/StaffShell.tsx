"use client";

import { DashboardShell } from "@/components/dashboard/DashboardShell";
import type { DashboardShellProfile } from "@/components/dashboard/types";
import { STAFF_NAV } from "./nav";

const COLLAPSE_KEY = "vetcare.staff.sidebarCollapsed";

export function StaffShell({
  profile,
  children,
}: {
  profile: DashboardShellProfile;
  children: React.ReactNode;
}) {
  return (
    <DashboardShell
      profile={profile}
      nav={STAFF_NAV}
      homeHref="/staff"
      navLabel="Staff"
      roleLabel="Staff"
      profileHref="/staff/profile"
      passwordHref="/staff/profile/password"
      collapseStorageKey={COLLAPSE_KEY}
      mobileMenuLabel="Staff menu"
    >
      {children}
    </DashboardShell>
  );
}
