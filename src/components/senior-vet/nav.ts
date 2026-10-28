import {
  CalendarIcon,
  ChartIcon,
  ClockIcon,
  DashboardIcon,
  FolderIcon,
  InventoryIcon,
  PhoneIcon,
  StampIcon,
  PosIcon,
  UsersIcon,
} from "@/components/ui/icons";
import {
  isDashboardNavActive,
  type DashboardNavItem,
  type DashboardShellProfile,
} from "@/components/dashboard/types";

export type SeniorVetShellProfile = DashboardShellProfile;
export type SeniorVetNavItem = DashboardNavItem;

export const SENIOR_VET_NAV: readonly DashboardNavItem[] = [
  { href: "/senior-vet", label: "Dashboard", exact: true, icon: DashboardIcon },
  { href: "/staff/analytics", label: "Analytics", icon: ChartIcon },
  {
    href: "/senior-vet/appointments",
    label: "Appointments",
    icon: CalendarIcon,
    alsoActive: ["/staff/appointments", "/staff/appointments/log"],
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
  { href: "/staff/loyalty", label: "Loyalty", icon: StampIcon, alsoActive: ["/senior-vet/loyalty"] },
  { href: "/staff/sms-templates", label: "SMS templates", icon: PhoneIcon },
];

export const isSeniorVetNavActive = isDashboardNavActive;
