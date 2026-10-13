import type { ComponentType, SVGProps } from "react";

export type DashboardShellProfile = {
  fullName: string;
  email: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
};

type IconComponent = ComponentType<SVGProps<SVGSVGElement>>;

export type DashboardNavItem = {
  href: string;
  label: string;
  exact?: boolean;
  icon: IconComponent;
  /** Extra path prefixes that should keep this item active. */
  alsoActive?: readonly string[];
};

export function isDashboardNavActive(pathname: string, item: DashboardNavItem): boolean {
  if (item.exact) return pathname === item.href;
  if (pathname === item.href || pathname.startsWith(`${item.href}/`)) return true;
  return (item.alsoActive ?? []).some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}
