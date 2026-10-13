"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** `exact` keeps a parent item (e.g. "/client") from staying highlighted on its sub-pages. */
export type PortalNavItem = { href: string; label: string; exact?: boolean };

export function PortalNav({ items }: { items: PortalNavItem[] }) {
  const pathname = usePathname();

  return (
    <nav aria-label="Portal" className="-mb-px flex gap-1 overflow-x-auto">
      {items.map((item) => {
        const active =
          pathname === item.href || (!item.exact && pathname.startsWith(`${item.href}/`));
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`whitespace-nowrap border-b-2 px-3 py-3 text-sm font-medium ${
              active
                ? "border-brand text-brand"
                : "border-transparent text-muted hover:text-brand"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
