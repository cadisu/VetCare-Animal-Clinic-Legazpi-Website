import type { Metadata } from "next";
import { DashboardHeading } from "@/components/portal/PlaceholderCard";
import { buttonClass } from "@/components/ui/button-styles";
import { panelClass } from "@/components/ui/panel-styles";
import {
  AUDIT_ACTIONS,
  AUDIT_ENTITY_TYPES,
  auditActionLabel,
  auditEntityLabel,
  formatAuditMetadata,
  formatAuditTime,
} from "@/lib/audit/labels";
import { requireRole } from "@/lib/auth/session";
import { addDaysIso, isIsoDate } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Audit logs" };

const MAX_RESULTS = 100;

type AuditRow = {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  metadata: unknown;
  created_at: string;
  actor: { full_name: string } | { full_name: string }[] | null;
};

function cleanToken(value: string | undefined, allowed: readonly string[]): string {
  return value && allowed.includes(value) ? value : "";
}

function actorName(actor: AuditRow["actor"]): string {
  if (!actor) return "System";
  if (Array.isArray(actor)) return actor[0]?.full_name || "System";
  return actor.full_name || "System";
}

export default async function SeniorVetAuditPage({
  searchParams,
}: {
  searchParams: Promise<{ action?: string; entity?: string; from?: string; to?: string }>;
}) {
  await requireRole(["SENIOR_VET"]);
  const query = await searchParams;
  const action = cleanToken(query.action, AUDIT_ACTIONS);
  const entity = cleanToken(query.entity, AUDIT_ENTITY_TYPES);
  const from = query.from && isIsoDate(query.from) ? query.from : "";
  const to = query.to && isIsoDate(query.to) ? query.to : "";

  const supabase = await createClient();
  let request = supabase
    .from("audit_logs")
    .select("id, action, entity_type, entity_id, metadata, created_at, actor:profiles!audit_logs_actor_id_fkey(full_name)")
    .order("created_at", { ascending: false })
    .limit(MAX_RESULTS);

  if (action) request = request.eq("action", action);
  if (entity) request = request.eq("entity_type", entity);
  if (from) request = request.gte("created_at", `${from}T00:00:00+08:00`);
  if (to) request = request.lt("created_at", `${addDaysIso(to, 1)}T00:00:00+08:00`);

  const { data, error } = await request;
  const rows = (data ?? []) as AuditRow[];

  return (
    <>
      <DashboardHeading
        title="Audit logs"
        subtitle="Important account, clinical, appointment, inventory, loyalty, and POS actions. Entries are not edited or deleted."
      />

      <form className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4" action="/senior-vet/audit">
        <label className="block text-sm font-medium text-ink">
          Action
          <select name="action" defaultValue={action} className="mt-1.5 block min-h-11 w-full rounded-lg border border-line bg-white px-3.5 text-base text-ink">
            <option value="">All actions</option>
            {AUDIT_ACTIONS.map((item) => (
              <option key={item} value={item}>
                {auditActionLabel(item)}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm font-medium text-ink">
          Record
          <select name="entity" defaultValue={entity} className="mt-1.5 block min-h-11 w-full rounded-lg border border-line bg-white px-3.5 text-base text-ink">
            <option value="">All records</option>
            {AUDIT_ENTITY_TYPES.map((item) => (
              <option key={item} value={item}>
                {auditEntityLabel(item)}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm font-medium text-ink">
          From
          <input name="from" type="date" defaultValue={from} className="mt-1.5 block min-h-11 w-full rounded-lg border border-line bg-white px-3.5 text-base text-ink" />
        </label>
        <label className="block text-sm font-medium text-ink">
          To
          <input name="to" type="date" defaultValue={to} className="mt-1.5 block min-h-11 w-full rounded-lg border border-line bg-white px-3.5 text-base text-ink" />
        </label>
        <div className="sm:col-span-2 lg:col-span-4">
          <button type="submit" className={buttonClass("primary")}>
            Filter
          </button>
        </div>
      </form>

      {error ? (
        <p className="text-sm text-accent-dark">Audit logs could not be loaded. Apply the Phase 12 database migration and try again.</p>
      ) : rows.length === 0 ? (
        <section className="rounded-2xl border border-dashed border-line bg-white p-10 text-center text-sm text-muted">
          No audit entries match this filter.
        </section>
      ) : (
        <div className={panelClass("overflow-x-auto")}>
          <table className="min-w-full divide-y divide-line text-sm">
            <thead className="bg-highlight/50 text-left text-xs font-semibold uppercase tracking-wide text-muted">
              <tr>
                <th scope="col" className="px-4 py-3">Time</th>
                <th scope="col" className="px-4 py-3">Actor</th>
                <th scope="col" className="px-4 py-3">Action</th>
                <th scope="col" className="px-4 py-3">Record</th>
                <th scope="col" className="px-4 py-3">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((row) => (
                <tr key={row.id}>
                  <td className="whitespace-nowrap px-4 py-3 text-ink">{formatAuditTime(row.created_at)}</td>
                  <td className="px-4 py-3">{actorName(row.actor)}</td>
                  <td className="px-4 py-3 font-medium text-ink">{auditActionLabel(row.action)}</td>
                  <td className="px-4 py-3">
                    <div>{auditEntityLabel(row.entity_type)}</div>
                    {row.entity_id && <div className="mt-1 font-mono text-xs text-muted">{row.entity_id}</div>}
                  </td>
                  <td className="max-w-sm px-4 py-3 text-muted">{formatAuditMetadata(row.metadata)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length === MAX_RESULTS && (
            <p className="border-t border-line px-4 py-3 text-xs text-muted">
              Showing the latest {MAX_RESULTS} entries. Narrow the dates to see older ones.
            </p>
          )}
        </div>
      )}
    </>
  );
}
