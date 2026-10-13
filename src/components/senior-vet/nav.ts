import type { ComponentType, SVGProps } from "react";
import {
  CalendarIcon,
  ClockIcon,
  DashboardIcon,
  FolderIcon,
  UsersIcon,
} from "@/components/ui/icons";

export type SeniorVetShellProfile = {
  fullName: string;
  email: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
};

type IconComponent = ComponentType<SVGProps<SVGSVGElement>>;

export type SeniorVetNavItem = {
  href: string;
  label: string;
  exact?: boolean;
  icon: IconComponent;
  /** Extra path prefixes that should keep this item active. */
  alsoActive?: readonly string[];
};

export const SENIOR_VET_NAV: readonly SeniorVetNavItem[] = [
  { href: "/senior-vet", label: "Dashboard", exact: true, icon: DashboardIcon },
  {
    href: "/senior-vet/appointments",
    label: "Appointments",
    icon: CalendarIcon,
    alsoActive: ["/staff/appointments"],
  },
  {
    href: "/staff/clients",
    label: "Clients and pet records",
    icon: UsersIcon,
    alsoActive: ["/staff/pets"],
  },
  { href: "/senior-vet/schedule", label: "Clinic schedule", icon: ClockIcon },
  { href: "/senior-vet/services", label: "Services", icon: FolderIcon },
];

export function isSeniorVetNavActive(pathname: string, item: SeniorVetNavItem): boolean {
  if (item.exact) return pathname === item.href;
  if (pathname === item.href || pathname.startsWith(`${item.href}/`)) return true;
  return (item.alsoActive ?? []).some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}
