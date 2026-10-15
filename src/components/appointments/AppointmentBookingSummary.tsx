export type BookingSummaryRow = {
  label: string;
  value: string;
};

export function AppointmentBookingSummary({
  rows,
  vetAcceptancePending,
}: {
  rows: BookingSummaryRow[];
  vetAcceptancePending?: boolean;
}) {
  return (
    <div>
      <dl className="grid gap-4 sm:grid-cols-2">
        {rows.map((row) => (
          <div key={row.label}>
            <dt className="text-xs font-medium uppercase text-slate-500">{row.label}</dt>
            <dd className="mt-1 text-sm text-slate-900">{row.value}</dd>
          </div>
        ))}
      </dl>
      {vetAcceptancePending && (
        <p className="mt-4 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-900">
          This visit is pending clinic confirmation. The clinic will confirm the appointment before
          check-in. You can cancel while the status is still Pending.
        </p>
      )}
    </div>
  );
}
