import type { Metadata } from "next";
import Link from "next/link";
import { buttonClass } from "@/components/ui/button-styles";
import { panelClass } from "@/components/ui/panel-styles";
import { Alert } from "@/components/ui/Alert";
import { ROLE_LABELS, USER_ROLES, type UserRole } from "@/lib/auth/roles";
import { requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { userErrorText, userNoticeText } from "@/lib/users/notices";

export const metadata: Metadata = { title: "Users" };

const MAX_RESULTS = 50;

type AccountRow = {
  id: string;
  full_name: string;
  email: string;
  contact_number: string | null;
  role: UserRole;
  status: "ACTIVE" | "INACTIVE";
};

function cleanSearch(value: string | undefined): string {
  return (value ?? "").replace(/[,()%*\\"]/g, " ").replace(/\s+/g, " ").trim().slice(0, 60);
}

function chosenRole(value: string | undefined): UserRole | "" {
  return USER_ROLES.includes(value as UserRole) ? (value as UserRole) : "";
}

function chosenStatus(value: string | undefined): "ACTIVE" | "INACTIVE" | "" {
  return value === "ACTIVE" || value === "INACTIVE" ? value : "";
}

export default async function SeniorVetUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; role?: string; status?: string; error?: string; notice?: string }>;
}) {
  await requireRole(["SENIOR_VET"]);
  const query = await searchParams;
  const q = cleanSearch(query.q);
  const role = chosenRole(query.role);
  const status = chosenStatus(query.status);
  const notice = userNoticeText(query.notice);
  const error = userErrorText(query.error);

  const supabase = await createClient();
  let request = supabase
    .from("profiles")
    .select("id, full_name, email, contact_number, role, status")
    .order("last_name", { ascending: true })
    .order("first_name", { ascending: true })
    .limit(MAX_RESULTS);

  if (role) request = request.eq("role", role);
  if (status) request = request.eq("status", status);
  if (q) {
    const pattern = `%${q}%`;
    request = request.or(
      ["full_name", "last_name", "first_name", "email", "contact_number"]
        .map((column) => `${column}.ilike."${pattern}"`)
        .join(","),
    );
  }

  const { data, error: loadError } = await request;
  const accounts = (data ?? []) as AccountRow[];

  return (
    <>
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">Users</h1>
          <p className="mt-2 max-w-2xl text-muted">
            Create staff and Senior Vet accounts, and activate or deactivate clinic accounts.
          </p>
        </div>
        <Link href="/senior-vet/users/new" className={`${buttonClass("primary")} shrink-0`}>
          New staff account
        </Link>
      </div>

      {notice && (
        <div className="mb-4">
          <Alert variant="success">{notice}</Alert>
        </div>
      )}
      {error && (
        <div className="mb-4">
          <Alert variant="error">{error}</Alert>
        </div>
      )}

      <form className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4" action="/senior-vet/users">
        <label className="block text-sm font-medium text-ink sm:col-span-2">
          Search
          <input
            name="q"
            type="search"
            defaultValue={q}
            placeholder="Name, email, or contact number"
            className="mt-1.5 block min-h-11 w-full rounded-lg border border-line bg-white px-3.5 text-base text-ink"
          />
        </label>
        <label className="block text-sm font-medium text-ink">
          Role
          <select name="role" defaultValue={role} className="mt-1.5 block min-h-11 w-full rounded-lg border border-line bg-white px-3.5 text-base text-ink">
            <option value="">All roles</option>
            {USER_ROLES.map((item) => (
              <option key={item} value={item}>
                {ROLE_LABELS[item]}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm font-medium text-ink">
          Status
          <select name="status" defaultValue={status} className="mt-1.5 block min-h-11 w-full rounded-lg border border-line bg-white px-3.5 text-base text-ink">
            <option value="">All statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
          </select>
        </label>
        <div className="flex gap-3 sm:col-span-2 lg:col-span-4">
          <button type="submit" className={buttonClass("primary")}>
            Search
          </button>
          {(q || role || status) && (
            <Link href="/senior-vet/users" className={buttonClass("ghost")}>
              Clear
            </Link>
          )}
        </div>
      </form>

      {loadError ? (
        <p className="text-sm text-accent-dark">Users could not be loaded. Apply the latest database migration and try again.</p>
      ) : accounts.length === 0 ? (
        <section className="rounded-2xl border border-dashed border-line bg-white p-10 text-center text-sm text-muted">
          {q || role || status ? "No accounts match this search." : "No accounts have been created yet."}
        </section>
      ) : (
        <div className={panelClass("overflow-x-auto")}>
          <table className="min-w-full divide-y divide-line text-sm">
            <thead className="bg-highlight/50 text-left text-xs font-semibold uppercase tracking-wide text-muted">
              <tr>
                <th scope="col" className="px-4 py-3">Name</th>
                <th scope="col" className="px-4 py-3">Email</th>
                <th scope="col" className="px-4 py-3">Contact no.</th>
                <th scope="col" className="px-4 py-3">Role</th>
                <th scope="col" className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {accounts.map((account) => (
                <tr key={account.id} className="hover:bg-brand-soft/40">
                  <td className="px-4 py-3 font-medium text-ink">
                    <Link href={`/senior-vet/users/${account.id}`} className="text-brand hover:underline">
                      {account.full_name || "(no name)"}
                    </Link>
                  </td>
                  <td className="px-4 py-3">{account.email}</td>
                  <td className="px-4 py-3">{account.contact_number ?? "—"}</td>
                  <td className="px-4 py-3">{ROLE_LABELS[account.role]}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        account.status === "ACTIVE" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {account.status === "ACTIVE" ? "Active" : "Inactive"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {accounts.length === MAX_RESULTS && (
            <p className="border-t border-line px-4 py-3 text-xs text-muted">
              Showing the first {MAX_RESULTS} results. Refine the search to narrow them down.
            </p>
          )}
        </div>
      )}
    </>
  );
}
