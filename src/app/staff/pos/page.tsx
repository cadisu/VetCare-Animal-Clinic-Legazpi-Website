import type { Metadata } from "next";
import Link from "next/link";
import { openCounterSaleAction, openPosForAppointmentAction } from "@/app/actions/pos";
import { PosNotice } from "@/components/pos/PosNotice";
import { PosSubmitButton } from "@/components/pos/PosSubmitButton";
import { DashboardHeading } from "@/components/portal/PlaceholderCard";
import { buttonClass } from "@/components/ui/button-styles";
import { panelClass, panelPaddingClass } from "@/components/ui/panel-styles";
import { formatTime12, type AppointmentListRow } from "@/lib/appointments/constants";
import { APPOINTMENT_LIST_SELECT } from "@/lib/appointments/server";
import { requireRole } from "@/lib/auth/session";
import { formatDate } from "@/lib/dates";
import { formatPeso } from "@/lib/pos/money";
import { listPosTransactions } from "@/lib/pos/server";
import { canBillAppointment } from "@/lib/pos/status";
import { isUuid } from "@/lib/pets/constants";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "POS" };

function cleanSearch(value: string | undefined): string {
  return (value ?? "").replace(/[,()%*\\"]/g, " ").replace(/\s+/g, " ").trim().slice(0, 60);
}

export default async function PosHomePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; client?: string; notice?: string; error?: string }>;
}) {
  await requireRole(["STAFF", "SENIOR_VET"]);
  const query = await searchParams;
  const q = cleanSearch(query.q);
  const clientId = query.client && isUuid(query.client) ? query.client : "";
  const supabase = await createClient();
  const openBills = await listPosTransactions(supabase, ["OPEN"], 30);

  let clients: { id: string; full_name: string; email: string }[] = [];
  if (q) {
    const pattern = `%${q}%`;
    const filters = ["full_name", "last_name", "first_name", "email", "contact_number"].map(
      (column) => `${column}.ilike."${pattern}"`,
    );
    const { data } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .eq("role", "CLIENT")
      .eq("status", "ACTIVE")
      .or(filters.join(","))
      .order("full_name", { ascending: true })
      .limit(20);
    clients = (data ?? []) as { id: string; full_name: string; email: string }[];
  }

  const { data: selected } = clientId
    ? await supabase
        .from("profiles")
        .select("id, full_name")
        .eq("id", clientId)
        .eq("role", "CLIENT")
        .eq("status", "ACTIVE")
        .maybeSingle()
    : { data: null };
  const { data: pets } = clientId
    ? await supabase
        .from("pets")
        .select("id, name")
        .eq("owner_id", clientId)
        .eq("is_archived", false)
        .order("name", { ascending: true })
    : { data: [] };
  const { data: visitRows } = clientId
    ? await supabase
        .from("appointments")
        .select(APPOINTMENT_LIST_SELECT)
        .eq("client_id", clientId)
        .in("status", ["IN_CONSULTATION", "COMPLETED"])
        .order("created_at", { ascending: false })
        .limit(20)
    : { data: [] };
  const visits = ((visitRows ?? []) as unknown as AppointmentListRow[]).filter((visit) =>
    canBillAppointment(visit.status),
  );

  return (
    <>
      <DashboardHeading
        title="Point of sale"
        subtitle="Record what the client received and the amount paid at the counter."
      />
      <PosNotice notice={query.notice} error={query.error} />
      <div className="mb-6 flex flex-wrap gap-3">
        <Link href="/staff/pos/history" className={buttonClass("outline")}>
          Transaction history
        </Link>
        <Link href="/staff/products" className={buttonClass("ghost")}>
          Products
        </Link>
      </div>

      <section className={panelPaddingClass("mb-6")}>
        <h2 className="text-base font-semibold text-ink">Open bills</h2>
        {openBills.length === 0 ? (
          <p className="mt-3 text-sm text-muted">No open bills.</p>
        ) : (
          <ul className="mt-3 divide-y divide-line text-sm">
            {openBills.map((bill) => (
              <li key={bill.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                <div>
                  <p className="font-medium text-ink">{bill.client_name}</p>
                  <p className="text-muted">
                    {bill.reference}
                    {bill.pet_name ? ` · ${bill.pet_name}` : ""} · {formatPeso(bill.total)}
                  </p>
                </div>
                <Link href={`/staff/pos/${bill.id}`} className="font-semibold text-brand hover:underline">
                  Resume
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={panelPaddingClass("mb-6")}>
        <h2 className="text-base font-semibold text-ink">Find a client</h2>
        <form role="search" action="/staff/pos" className="mt-4 flex flex-col gap-3 sm:flex-row">
          <label htmlFor="q" className="sr-only">
            Search clients
          </label>
          <input
            id="q"
            name="q"
            type="search"
            defaultValue={q}
            placeholder="Name, email, or contact number"
            className="block min-h-11 w-full rounded-lg border border-line bg-white px-3.5 text-base text-ink placeholder:text-muted/70 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
          />
          <button type="submit" className={buttonClass("primary")}>
            Search
          </button>
        </form>
        {q && clients.length === 0 && <p className="mt-4 text-sm text-muted">No active clients match that search.</p>}
        {clients.length > 0 && (
          <ul className="mt-4 divide-y divide-line text-sm">
            {clients.map((client) => (
              <li key={client.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                <div>
                  <p className="font-medium text-ink">{client.full_name}</p>
                  <p className="text-muted">{client.email}</p>
                </div>
                <Link href={`/staff/pos?client=${client.id}`} className="font-semibold text-brand hover:underline">
                  Select
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {selected && (
        <section className={panelPaddingClass()}>
          <h2 className="text-base font-semibold text-ink">{selected.full_name}</h2>
          <p className="mt-2 text-sm text-muted">
            Bill a visit that is in consultation or already completed, or start a product sale with no visit.
          </p>

          <div className="mt-6 space-y-3">
            {visits.length === 0 ? (
              <p className="text-sm text-muted">No billable visit for this client.</p>
            ) : (
              visits.map((visit) => (
                <form
                  key={visit.id}
                  action={openPosForAppointmentAction}
                  className={`${panelClass("flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between")}`}
                >
                  <input type="hidden" name="appointmentId" value={visit.id} />
                  <input type="hidden" name="returnTo" value={`/staff/pos?client=${selected.id}`} />
                  <div className="text-sm">
                    <p className="font-medium text-ink">
                      {visit.service.name} · {visit.pet.name}
                    </p>
                    <p className="text-muted">
                      {formatDate(visit.slot.slot_date)} at {formatTime12(visit.slot.start_time)}
                    </p>
                  </div>
                  <PosSubmitButton pendingText="Opening...">Bill this visit</PosSubmitButton>
                </form>
              ))
            )}
          </div>

          <form action={openCounterSaleAction} className="mt-6 space-y-3 border-t border-line pt-6">
            <input type="hidden" name="clientId" value={selected.id} />
            <input type="hidden" name="returnTo" value={`/staff/pos?client=${selected.id}`} />
            <h3 className="text-sm font-semibold text-ink">Product sale with no visit</h3>
            <label htmlFor="petId" className="text-sm font-medium text-ink">
              Pet <span className="font-normal text-muted">(optional)</span>
            </label>
            <select
              id="petId"
              name="petId"
              className="block min-h-11 w-full rounded-lg border border-line bg-white px-3.5 text-sm text-ink focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
              defaultValue=""
            >
              <option value="">No pet</option>
              {(pets ?? []).map((pet) => (
                <option key={pet.id} value={pet.id}>
                  {pet.name}
                </option>
              ))}
            </select>
            <PosSubmitButton variant="outline" pendingText="Starting...">
              Start product sale
            </PosSubmitButton>
          </form>
        </section>
      )}
    </>
  );
}
