import Link from "next/link";
import { APPOINTMENT_STATUSES, STATUS_LABELS } from "@/lib/appointments/constants";
import type { AnalyticsReport } from "@/lib/analytics/server";
import { RECORDED_SALES_LABEL } from "@/lib/analytics/metrics";
import { ANALYTICS_PRESETS, analyticsPresetLabel, type AnalyticsPreset } from "@/lib/analytics/range";
import { formatDate } from "@/lib/dates";
import type { InventoryAlerts } from "@/lib/inventory/server";
import { formatClinicDateTime, formatPeso } from "@/lib/pos/money";
import { buttonClass } from "@/components/ui/button-styles";
import { panelClass, panelPaddingClass } from "@/components/ui/panel-styles";

export function AnalyticsFilters({
  preset,
  from,
  to,
}: {
  preset: AnalyticsPreset | null;
  from: string;
  to: string;
}) {
  return (
    <section className={panelPaddingClass("mb-6")}>
      <div className="flex flex-wrap gap-2">
        {ANALYTICS_PRESETS.filter((value) => value !== "custom").map((value) => (
          <Link
            key={value}
            href={`/staff/analytics?preset=${value}`}
            className={buttonClass(preset === value ? "primary" : "outline")}
          >
            {analyticsPresetLabel(value)}
          </Link>
        ))}
        <span aria-current={preset === "custom" ? "page" : undefined} className={buttonClass(preset === "custom" ? "primary" : "outline")}>{analyticsPresetLabel("custom")}</span>
      </div>
      <form action="/staff/analytics" className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <input type="hidden" name="preset" value="custom" />
        <label className="block text-sm text-ink">
          Start
          <input
            name="from"
            type="date"
            defaultValue={preset === "custom" ? from : ""}
            required
            className="mt-1 min-h-11 w-full rounded-lg border border-line px-3 text-sm"
          />
        </label>
        <label className="block text-sm text-ink">
          End
          <input
            name="to"
            type="date"
            defaultValue={preset === "custom" ? to : ""}
            required
            className="mt-1 min-h-11 w-full rounded-lg border border-line px-3 text-sm"
          />
        </label>
        <button type="submit" className={buttonClass("primary")}>
          Apply range
        </button>
      </form>
      {from && to ? (
        <p className="mt-3 text-sm text-muted">
          {formatDate(from)} to {formatDate(to)}, Asia/Manila. The start and end dates are included.
        </p>
      ) : null}
    </section>
  );
}

function Metric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <section className={panelPaddingClass()}>
      <h2 className="text-sm font-semibold text-muted">{label}</h2>
      <p className="mt-2 text-2xl font-semibold text-ink">{value}</p>
      <p className="mt-2 text-sm text-muted">{detail}</p>
    </section>
  );
}

function share(count: number, total: number): string {
  if (total <= 0) return "0%";
  return `${Math.round((count / total) * 100)}%`;
}

function periodIsEmpty(report: AnalyticsReport): boolean {
  const loyalty = report.loyalty;
  return (
    report.customersRegistered === 0 &&
    report.appointments.scheduled === 0 &&
    report.appointments.booked === 0 &&
    report.services.bills === 0 &&
    report.sales.transactions === 0 &&
    loyalty.stampsEarnedNet === 0 &&
    loyalty.stampsReversed === 0 &&
    loyalty.rewardsUnlocked === 0 &&
    loyalty.rewardsRevoked === 0 &&
    loyalty.rewardsRedeemed === 0 &&
    loyalty.redemptionsRestored === 0
  );
}

export function AnalyticsReportView({ report }: { report: AnalyticsReport }) {
  const statuses = report.appointments.statuses;
  const statusMax = Math.max(...APPOINTMENT_STATUSES.map((status) => statuses[status]), 1);
  const visits = report.appointments.scheduled;
  const serviceMax = Math.max(...report.services.rows.map((row) => row.transactionCount), 1);
  const salesMax = Math.max(...report.sales.days.map((day) => day.recordedSales), 0);
  const quietDays = report.sales.days.filter((day) => day.recordedSales === 0).length;

  return (
    <div className="space-y-6">
      {periodIsEmpty(report) ? (
        <section className="rounded-2xl border border-dashed border-line bg-white p-8 text-center text-sm text-muted">
          No customers, appointments, completed sales, or loyalty events were recorded in this period.
        </section>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric
          label="Customers registered"
          value={String(report.customersRegistered)}
          detail="Client accounts created in this period. Pets and bookings are not included."
        />
        <Metric
          label="Scheduled appointments"
          value={String(report.appointments.scheduled)}
          detail="Visits whose appointment date falls in this period."
        />
        <Metric
          label="Booked during this period"
          value={String(report.appointments.booked)}
          detail="Appointments created in this period, even when the visit is on another day."
        />
        <Metric
          label={RECORDED_SALES_LABEL}
          value={formatPeso(report.sales.recordedSales)}
          detail="Completed bills only. This is the stored amount due after discounts and rewards."
        />
      </div>

      <section className={panelPaddingClass()}>
        <h2 className="text-base font-semibold text-ink">Appointment status</h2>
        <p className="mt-2 text-sm text-muted">
          These {report.appointments.scheduled} scheduled appointments are each counted in one status.
        </p>
        <ul className="mt-4 space-y-3">
          {APPOINTMENT_STATUSES.map((status) => {
            const count = statuses[status];
            return (
              <li key={status}>
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="font-medium text-ink">{STATUS_LABELS[status]}</span>
                  <span className="text-muted">
                    {count} · {share(count, visits)}
                  </span>
                </div>
                <div className="mt-1 h-2 rounded-full bg-highlight">
                  <div className="h-2 rounded-full bg-brand" style={{ width: `${(count / statusMax) * 100}%` }} />
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <section className={panelPaddingClass()}>
        <h2 className="text-base font-semibold text-ink">Appointment-based and walk-in visits</h2>
        <p className="mt-2 text-sm text-muted">
          These counts are appointments scheduled in the period, classified by the stored visit source. They are not unique customers.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-sm font-semibold text-ink">Appointment-based visits</p>
            <p className="mt-1 text-2xl font-semibold text-ink">{report.appointments.sources.appointment}</p>
            <p className="text-sm text-muted">{share(report.appointments.sources.appointment, visits)} of scheduled visits</p>
          </div>
          <div>
            <p className="text-sm font-semibold text-ink">Walk-in visits</p>
            <p className="mt-1 text-2xl font-semibold text-ink">{report.appointments.sources.walkIn}</p>
            <p className="text-sm text-muted">{share(report.appointments.sources.walkIn, visits)} of scheduled visits</p>
          </div>
        </div>
        <div className="mt-4 flex h-3 overflow-hidden rounded-full bg-highlight">
          <div className="bg-brand" style={{ width: visits === 0 ? "0%" : `${(report.appointments.sources.appointment / visits) * 100}%` }} />
          <div className="bg-accent" style={{ width: visits === 0 ? "0%" : `${(report.appointments.sources.walkIn / visits) * 100}%` }} />
        </div>
        <p className="mt-4 text-sm text-muted">
          {report.sales.counterBills} completed counter {report.sales.counterBills === 1 ? "bill has" : "bills have"} no client account
          ({formatPeso(report.sales.counterRecordedSales)} recorded sales). Those bills are included in recorded sales and are not walk-in appointments.
        </p>
      </section>

      <section className={panelPaddingClass()}>
        <h2 className="text-base font-semibold text-ink">Sales</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div>
            <p className="text-sm text-muted">Gross sales</p>
            <p className="mt-1 text-xl font-semibold text-ink">{formatPeso(report.sales.gross)}</p>
          </div>
          <div>
            <p className="text-sm text-muted">Discounts recorded</p>
            <p className="mt-1 text-xl font-semibold text-ink">{formatPeso(report.sales.discounts)}</p>
          </div>
          <div>
            <p className="text-sm text-muted">Rewards applied</p>
            <p className="mt-1 text-xl font-semibold text-ink">{formatPeso(report.sales.rewards)}</p>
          </div>
          <div>
            <p className="text-sm text-muted">{RECORDED_SALES_LABEL}</p>
            <p className="mt-1 text-xl font-semibold text-ink">{formatPeso(report.sales.recordedSales)}</p>
          </div>
        </div>
        <p className="mt-3 text-sm text-muted">
          {report.sales.transactions} completed {report.sales.transactions === 1 ? "bill" : "bills"}. Open and voided bills are excluded.
          Recorded sales are the stored bill total.
        </p>
        <h3 className="mt-6 text-sm font-semibold text-ink">Recorded sales by day</h3>
        <p className="mt-1 text-sm text-muted">
          {report.sales.days.length} days are shown, including {quietDays} with no completed sales.
        </p>
        <div className="mt-4 overflow-x-auto">
          <div className="flex h-40 min-w-full items-end gap-1" style={{ width: Math.max(report.sales.days.length * 12, 0) }}>
            {report.sales.days.map((day) => {
              const height = salesMax <= 0 ? 0 : Math.max((day.recordedSales / salesMax) * 100, day.recordedSales > 0 ? 4 : 0);
              return (
                <div key={day.date} className="flex h-full w-2 shrink-0 flex-col justify-end" title={`${formatDate(day.date)}: ${formatPeso(day.recordedSales)}`}>
                  <div
                    className={day.recordedSales === 0 ? "w-full rounded-sm bg-line" : "w-full rounded-sm bg-brand"}
                    style={{ height: day.recordedSales === 0 ? "2px" : `${height}%` }}
                  />
                </div>
              );
            })}
          </div>
        </div>
        <p className="sr-only">
          Daily recorded sales from {formatDate(report.sales.days[0]?.date)} to {formatDate(report.sales.days.at(-1)?.date)}.
          Days without a completed sale stay in the chart at zero.
        </p>
        {report.sales.recent.length === 0 ? (
          <p className="mt-6 text-sm text-muted">No completed bills in this period.</p>
        ) : (
          <div className={panelClass("mt-6 overflow-x-auto")}>
            <table className="min-w-full divide-y divide-line text-sm">
              <thead className="bg-highlight/50 text-left text-xs font-semibold uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-4 py-3">Reference</th>
                  <th className="px-4 py-3">Completed</th>
                  <th className="px-4 py-3">Gross</th>
                  <th className="px-4 py-3">Discounts</th>
                  <th className="px-4 py-3">Rewards</th>
                  <th className="px-4 py-3">{RECORDED_SALES_LABEL}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {report.sales.recent.map((sale) => (
                  <tr key={sale.id ?? sale.reference}>
                    <td className="px-4 py-3 font-semibold text-brand">
                      {sale.id ? <Link href={`/staff/pos/${sale.id}`} className="hover:underline">{sale.reference}</Link> : sale.reference}
                    </td>
                    <td className="px-4 py-3">{formatClinicDateTime(sale.completedAt)}</td>
                    <td className="px-4 py-3">{formatPeso(sale.gross)}</td>
                    <td className="px-4 py-3">{formatPeso(sale.discounts)}</td>
                    <td className="px-4 py-3">{formatPeso(sale.rewards)}</td>
                    <td className="px-4 py-3">{formatPeso(sale.recordedSales)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className={panelPaddingClass()}>
        <h2 className="text-base font-semibold text-ink">Services</h2>
        <p className="mt-2 text-sm text-muted">
          {report.services.bills} completed {report.services.bills === 1 ? "bill includes" : "bills include"} a service.
          Each service counts once per bill. The amount is the sum of that service&apos;s stored line subtotals, using the name saved on the bill.
        </p>
        {report.services.rows.length === 0 ? (
          <p className="mt-4 text-sm text-muted">No completed service bills in this period.</p>
        ) : (
          <div className="mt-4 space-y-4">
            {report.services.rows.map((row) => (
              <div key={row.serviceId ?? row.description}>
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="font-medium text-ink">{row.description}</span>
                  <span className="text-muted">
                    {row.transactionCount} {row.transactionCount === 1 ? "bill" : "bills"} · {formatPeso(row.recordedAmount)}
                  </span>
                </div>
                <div className="mt-1 h-2 rounded-full bg-highlight">
                  <div className="h-2 rounded-full bg-brand" style={{ width: `${(row.transactionCount / serviceMax) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-4">
        <h2 className="text-base font-semibold text-ink">Loyalty</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <Metric label="Net stamps earned" value={String(report.loyalty.stampsEarnedNet)} detail="Active earn events in this period. Reversed earns are excluded." />
          <Metric label="Stamps reversed" value={String(report.loyalty.stampsReversed)} detail="Reversal events recorded in this period." />
          <Metric label="Rewards unlocked" value={String(report.loyalty.rewardsUnlocked)} detail="Grants unlocked in this period, excluding grants that are currently revoked." />
          <Metric label="Rewards revoked" value={String(report.loyalty.rewardsRevoked)} detail="Unlocked in this period and currently revoked. A separate revocation time is not stored." />
          <Metric label="Rewards redeemed" value={String(report.loyalty.rewardsRedeemed)} detail="Applied redemptions. A grant or a hold on an open bill is not a redemption." />
          <Metric label="Redemptions restored" value={String(report.loyalty.redemptionsRestored)} detail="Restored in the loyalty record. These are not counted as redeemed." />
        </div>
      </section>
    </div>
  );
}

export function InventoryAnalytics({ alerts }: { alerts: InventoryAlerts }) {
  return (
    <section className="mt-6 space-y-4">
      <div>
        <h2 className="text-base font-semibold text-ink">Current inventory alerts</h2>
        <p className="mt-1 text-sm text-muted">
          These figures are the stock on hand now. They do not follow the date filter. Expiring soon means within {alerts.warningDays} days.
          An expired batch does not mark the whole product expired.
        </p>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <StockTable
          title="Out of stock"
          empty="No products are out of stock."
          rows={alerts.out.map((product) => ({
            id: product.id,
            name: product.name,
            detail: `${product.quantityOnHand} on hand`,
          }))}
        />
        <StockTable
          title="Low stock"
          empty="No products are low on stock."
          rows={alerts.low.map((product) => ({
            id: product.id,
            name: product.name,
            detail: `${product.quantityOnHand} on hand${product.minimumStock === null ? "" : `, low-stock warning ${product.minimumStock}`}`,
          }))}
        />
        <StockTable
          title="Expiring soon"
          empty="No unexpired batches are inside the warning window."
          rows={alerts.expiringSoon.map((batch) => ({
            id: batch.productId,
            name: batch.productName,
            detail: `${batch.quantity} remaining · expires ${formatDate(batch.expirationDate)}`,
          }))}
        />
        <StockTable
          title="Expired"
          empty="No batches with remaining quantity are past their expiration date."
          rows={alerts.expired.map((batch) => ({
            id: batch.productId,
            name: batch.productName,
            detail: `${batch.quantity} remaining · expired ${formatDate(batch.expirationDate)}`,
          }))}
        />
      </div>
    </section>
  );
}

function StockTable({ title, empty, rows }: { title: string; empty: string; rows: { id: string; name: string; detail: string }[] }) {
  return (
    <div className={panelClass("overflow-x-auto")}>
      <h3 className="px-4 py-3 text-sm font-semibold text-ink">{title}</h3>
      {rows.length === 0 ? (
        <p className="px-4 pb-4 text-sm text-muted">{empty}</p>
      ) : (
        <table className="min-w-full divide-y divide-line text-sm">
          <tbody className="divide-y divide-line">
            {rows.map((row, index) => (
              <tr key={`${row.id}-${index}`}>
                <td className="px-4 py-3">
                  <Link href={`/staff/inventory/${row.id}`} className="font-semibold text-brand hover:underline">
                    {row.name}
                  </Link>
                  <span className="mt-0.5 block text-xs text-muted">{row.detail}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
