"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/senior-vet/appointments", label: "Today", exact: true },
  { href: "/senior-vet/appointments/future", label: "Future", exact: false },
  { href: "/senior-vet/appointments/log", label: "Appointment Log", exact: false },
];

export function AppointmentSectionNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Appointment views" className="-mb-px flex gap-1 overflow-x-auto border-b border-line">
      {TABS.map((tab) => {
        const active = tab.exact ? pathname === tab.href : pathname === tab.href || pathname.startsWith(`${tab.href}/`);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={`whitespace-nowrap border-b-2 px-3 py-3 text-sm font-medium ${
              active ? "border-brand text-brand" : "border-transparent text-muted hover:text-brand"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
