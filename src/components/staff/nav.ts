import { CalendarIcon, DashboardIcon, UsersIcon } from "@/components/ui/icons";
import type { DashboardNavItem } from "@/components/dashboard/types";

export const STAFF_NAV: readonly DashboardNavItem[] = [
  { href: "/staff", label: "Dashboard", exact: true, icon: DashboardIcon },
  {
    href: "/staff/appointments",
    label: "Appointments",
    icon: CalendarIcon,
  },
  {
    href: "/staff/clients",
    label: "Clients",
    icon: UsersIcon,
    alsoActive: ["/staff/pets"],
  },
];
