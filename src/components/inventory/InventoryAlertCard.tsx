import Link from "next/link";
import { panelPaddingClass } from "@/components/ui/panel-styles";
import type { InventoryAlerts } from "@/lib/inventory/server";

function names(items: { name?: string; productName?: string }[], empty: string) {
  if (items.length === 0) return empty;
  const shown = items.slice(0, 3).map((item) => item.name ?? item.productName);
  const extra = items.length > 3 ? ` +${items.length - 3} more` : "";
  return `${shown.join(", ")}${extra}`;
}

export function InventoryAlertCard({ alerts }: { alerts: InventoryAlerts }) {
  const rows = [
    {
      label: "Out of stock",
      count: alerts.out.length,
      href: "/staff/inventory?stock=out",
      detail: names(alerts.out, "None"),
    },
    {
      label: "Low stock",
      count: alerts.low.length,
      href: "/staff/inventory?stock=low",
      detail: names(alerts.low, "None"),
    },
    {
      label: "Expiring soon",
      count: alerts.expiringSoon.length,
      href: "/staff/inventory?expiry=soon",
      detail: names(alerts.expiringSoon, "None"),
    },
    {
      label: "Expired",
      count: alerts.expired.length,
      href: "/staff/inventory?expiry=expired",
      detail: names(alerts.expired, "None"),
    },
  ];

  return (
    <section className={panelPaddingClass()}>
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-base font-semibold text-ink">Inventory</h2>
        <Link href="/staff/inventory" className="text-sm font-semibold text-brand hover:underline">
          Open inventory
        </Link>
      </div>
      <p className="mt-2 text-sm text-muted">Expiring soon means within {alerts.warningDays} days.</p>
      <ul className="mt-4 space-y-3">
        {rows.map((row) => (
          <li key={row.label}>
            <Link href={row.href} className="block rounded-lg hover:bg-highlight/60">
              <span className="text-sm font-semibold text-ink">
                {row.count} {row.label.toLowerCase()}
              </span>
              <span className="mt-0.5 block text-xs text-muted">{row.detail}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
