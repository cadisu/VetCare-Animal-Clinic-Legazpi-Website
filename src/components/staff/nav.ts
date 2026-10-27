import { CalendarIcon, ClockIcon, DashboardIcon, FolderIcon, InventoryIcon, PhoneIcon, PosIcon, UsersIcon } from "@/components/ui/icons";
import type { DashboardNavItem } from "@/components/dashboard/types";

export const STAFF_NAV: readonly DashboardNavItem[] = [
  { href: "/staff", label: "Dashboard", exact: true, icon: DashboardIcon },
  {
    href: "/staff/appointments",
    label: "Appointments",
    icon: CalendarIcon,
    alsoActive: ["/staff/appointments/log"],
  },
  {
    href: "/staff/clients",
    label: "Clients and pet records",
    icon: UsersIcon,
    alsoActive: ["/staff/pets"],
  },
  { href: "/staff/schedule", label: "Clinic schedule", icon: ClockIcon },
  { href: "/staff/pos", label: "POS", icon: PosIcon },
  { href: "/staff/inventory", label: "Inventory", icon: InventoryIcon, alsoActive: ["/staff/inventory/history"] },
  { href: "/staff/services", label: "Services", icon: FolderIcon },
  { href: "/staff/sms-templates", label: "SMS templates", icon: PhoneIcon },
];
