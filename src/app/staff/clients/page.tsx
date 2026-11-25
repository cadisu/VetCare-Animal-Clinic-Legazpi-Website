import type { Metadata } from "next";
import Link from "next/link";
import { DashboardHeading } from "@/components/portal/PlaceholderCard";
import { buttonClass } from "@/components/ui/button-styles";
import { panelClass } from "@/components/ui/panel-styles";
import { requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Clients" };

const MAX_RESULTS = 50;

type ClientRow = {
  id: string;
  full_name: string;
  email: string;
  contact_number: string | null;
  status: "ACTIVE" | "INACTIVE";
  pets: { count: number }[];
};

/** Strips characters that have meaning in PostgREST filters or LIKE patterns. */
function cleanSearch(value: string | undefined): string {
  return (value ?? "").replace(/[,()%*\\"]/g, " ").replace(/\s+/g, " ").trim().slice(0, 60);
}

export default async function StaffClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  await requireRole(["STAFF", "SENIOR_VET"]);
  const q = cleanSearch((await searchParams).q);

  const supabase = await createClient();
  let query = supabase
    .from("profiles")
    .select("id, full_name, email, contact_number, status, pets(count)")
    .eq("role", "CLIENT")
    .eq("pets.is_archived", false)
    .order("last_name", { ascending: true })
    .order("first_name", { ascending: true })
    .limit(MAX_RESULTS);

  if (q) {
    const pattern = `%${q}%`;
    // Also match clients by their pets' names.
    const { data: petOwners } = await supabase
      .from("pets")
      .select("owner_id")
      .ilike("name", pattern)
      .limit(MAX_RESULTS);
    const ownerIds = [...new Set((petOwners ?? []).map((p) => p.owner_id as string))];

    const filters = ["full_name", "last_name", "first_name", "email", "contact_number"].map(
      (column) => `${column}.ilike."${pattern}"`,
    );
    if (ownerIds.length) filters.push(`id.in.(${ownerIds.join(",")})`);
    query = query.or(filters.join(","));
  }

  const { data, error } = await query;
  const clients = (data ?? []) as ClientRow[];

  return (
    <>
      <DashboardHeading title="Clients" />

      <form role="search" className="mb-6 flex flex-col gap-3 sm:flex-row" action="/staff/clients">
        <label htmlFor="q" className="sr-only">
          Search clients
        </label>
        <input
          id="q"
          name="q"
          type="search"
          defaultValue={q}
          placeholder="Search by name, email, contact no. or pet name"
          className="block min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3.5 text-base text-slate-900 placeholder:text-slate-400 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
        />
        <button type="submit" className={buttonClass("primary")}>
          Search
        </button>
        {q && (
          <Link href="/staff/clients" className={buttonClass("ghost")}>
            Clear
          </Link>
        )}
      </form>

      {error ? (
        <p className="text-sm text-accent-dark">We couldn&apos;t load clients. Please try again.</p>
      ) : clients.length === 0 ? (
        <section className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-600">
          {q ? `No clients match "${q}".` : "No clients have registered yet."}
        </section>
      ) : (
        <div className={panelClass("overflow-x-auto")}>
          <table className="min-w-full divide-y divide-line text-sm">
            <thead className="bg-highlight/50 text-left text-xs font-semibold uppercase tracking-wide text-muted">
              <tr>
                <th scope="col" className="px-4 py-3">Name</th>
                <th scope="col" className="px-4 py-3">Contact no.</th>
                <th scope="col" className="px-4 py-3">Email</th>
                <th scope="col" className="px-4 py-3">Pets</th>
                <th scope="col" className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {clients.map((client) => (
                <tr key={client.id} className="hover:bg-brand-soft/40">
                  <td className="px-4 py-3 font-medium text-slate-900">
                    <Link href={`/staff/clients/${client.id}`} className="text-brand hover:underline">
                      {client.full_name || "(no name)"}
                    </Link>
                  </td>
                  <td className="px-4 py-3">{client.contact_number ?? "—"}</td>
                  <td className="px-4 py-3">{client.email}</td>
                  <td className="px-4 py-3">{client.pets?.[0]?.count ?? 0}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        client.status === "ACTIVE"
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {client.status === "ACTIVE" ? "Active" : "Inactive"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {clients.length === MAX_RESULTS && (
            <p className="border-t border-slate-100 px-4 py-3 text-xs text-slate-500">
              Showing the first {MAX_RESULTS} results. Refine your search to narrow them down.
            </p>
          )}
        </div>
      )}
    </>
  );
}
