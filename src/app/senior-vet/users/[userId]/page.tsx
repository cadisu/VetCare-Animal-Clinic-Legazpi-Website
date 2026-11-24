import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { setAccountRoleAction, setAccountStatusAction } from "@/app/actions/users";
import { DashboardHeading } from "@/components/portal/PlaceholderCard";
import { AdminProfileForm } from "@/components/users/AdminProfileForm";
import { Alert } from "@/components/ui/Alert";
import { buttonClass } from "@/components/ui/button-styles";
import { ConfirmSubmitButton } from "@/components/ui/ConfirmSubmitButton";
import { panelPaddingClass } from "@/components/ui/panel-styles";
import { ROLE_LABELS, isUserRole, type UserRole } from "@/lib/auth/roles";
import { requireRole } from "@/lib/auth/session";
import { formatDate } from "@/lib/dates";
import { isUuid } from "@/lib/pets/constants";
import { createClient } from "@/lib/supabase/server";
import { userErrorText, userNoticeText } from "@/lib/users/notices";

export const metadata: Metadata = { title: "Account" };

type AccountDetail = {
  id: string;
  full_name: string;
  first_name: string;
  middle_name: string | null;
  last_name: string;
  email: string;
  contact_number: string | null;
  address: string | null;
  birthdate: string | null;
  role: UserRole;
  status: "ACTIVE" | "INACTIVE";
  created_at: string;
};

export default async function SeniorVetUserDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ userId: string }>;
  searchParams: Promise<{ notice?: string; error?: string }>;
}) {
  const actor = await requireRole(["SENIOR_VET"]);
  const { userId } = await params;
  if (!isUuid(userId)) notFound();

  const query = await searchParams;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select(
      "id, full_name, first_name, middle_name, last_name, email, contact_number, address, birthdate, role, status, created_at",
    )
    .eq("id", userId)
    .maybeSingle();

  if (error || !data || !isUserRole(data.role)) notFound();
  const account = data as AccountDetail;
  const isSelf = account.id === actor.id;
  const notice = userNoticeText(query.notice);
  const pageError = userErrorText(query.error);

  return (
    <>
      <DashboardHeading
        title={account.full_name || "Account"}
        subtitle={`${ROLE_LABELS[account.role]} · ${account.status === "ACTIVE" ? "Active" : "Inactive"} · joined ${formatDate(account.created_at)}`}
      />

      <div className="mb-4">
        <Link href="/senior-vet/users" className="text-sm font-medium text-brand hover:underline">
          Back to users
        </Link>
      </div>

      {notice && (
        <div className="mb-4">
          <Alert variant="success">{notice}</Alert>
        </div>
      )}
      {pageError && (
        <div className="mb-4">
          <Alert variant="error">{pageError}</Alert>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(16rem,1fr)]">
        <section className={panelPaddingClass()}>
          <h2 className="text-base font-semibold text-ink">Account details</h2>
          <p className="mt-1 text-sm text-muted">Email stays the login identity and is not edited here.</p>
          <p className="mt-3 text-sm text-ink">{account.email}</p>
          <div className="mt-6">
            <AdminProfileForm
              userId={account.id}
              role={account.role}
              defaults={{
                lastName: account.last_name,
                middleName: account.middle_name ?? "",
                firstName: account.first_name,
                contactNumber: account.contact_number ?? "",
                address: account.address ?? "",
                birthdate: account.birthdate ?? "",
              }}
            />
          </div>
        </section>

        <div className="space-y-6">
          <section className={panelPaddingClass()}>
            <h2 className="text-base font-semibold text-ink">Access</h2>
            {isSelf ? (
              <p className="mt-3 text-sm text-muted">You cannot change your own role or deactivate your own account.</p>
            ) : (
              <form action={setAccountStatusAction} className="mt-4">
                <input type="hidden" name="userId" value={account.id} />
                <input type="hidden" name="status" value={account.status === "ACTIVE" ? "INACTIVE" : "ACTIVE"} />
                {account.status === "ACTIVE" ? (
                  <ConfirmSubmitButton
                    confirmMessage="Deactivate this account? Their visits, bills, and records stay, and they will not be able to sign in."
                    variant="outline"
                  >
                    Deactivate
                  </ConfirmSubmitButton>
                ) : (
                  <button type="submit" className={buttonClass("primary")}>
                    Reactivate
                  </button>
                )}
              </form>
            )}
          </section>

          {account.role !== "CLIENT" && !isSelf && (
            <section className={panelPaddingClass()}>
              <h2 className="text-base font-semibold text-ink">Role</h2>
              <p className="mt-1 text-sm text-muted">A client account is not promoted from this page.</p>
              <form action={setAccountRoleAction} className="mt-4 space-y-4">
                <input type="hidden" name="userId" value={account.id} />
                <label className="block text-sm font-medium text-ink">
                  Role
                  <select
                    name="role"
                    defaultValue={account.role}
                    className="mt-1.5 block min-h-11 w-full rounded-lg border border-line bg-white px-3.5 text-base text-ink"
                  >
                    <option value="STAFF">Staff</option>
                    <option value="SENIOR_VET">Senior Vet</option>
                  </select>
                </label>
                <button type="submit" className={buttonClass("outline")}>
                  Save role
                </button>
              </form>
            </section>
          )}
        </div>
      </div>
    </>
  );
}
