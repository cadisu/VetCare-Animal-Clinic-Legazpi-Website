import type { Metadata } from "next";
import Link from "next/link";
import { StaffAppointmentForm } from "@/components/appointments/StaffAppointmentForm";
import { DashboardHeading } from "@/components/portal/PlaceholderCard";
import { buttonClass } from "@/components/ui/button-styles";
import { listActiveVeterinarians, listBookableServices } from "@/lib/appointments/server";
import { requireRole } from "@/lib/auth/session";
import { todayIso } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Walk-in / Book" };

export default async function StaffNewAppointmentPage({
  searchParams,
}: {
  searchParams: Promise<{ clientId?: string; source?: string }>;
}) {
  await requireRole(["STAFF", "SENIOR_VET"]);
  const params = await searchParams;
  const supabase = await createClient();

  if (!params.clientId) {
    const { data: clients } = await supabase
      .from("profiles")
      .select("id, full_name")
      .eq("role", "CLIENT")
      .eq("status", "ACTIVE")
      .order("last_name")
      .limit(50);
    return (
      <>
        <DashboardHeading
          title="Walk-in or book on behalf"
          subtitle="Select a client first (existing clients and pets only in Phase 3)."
        />
        <ul className="mt-6 space-y-2">
          {(clients ?? []).map((c) => (
            <li key={c.id}>
              <Link
                href={`/staff/appointments/new?clientId=${c.id}&source=${params.source ?? "WALK_IN"}`}
                className="block rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium hover:border-brand/40"
              >
                {c.full_name}
              </Link>
            </li>
          ))}
        </ul>
        <Link href="/staff/clients" className={buttonClass("outline", "md", "mt-6 inline-flex")}>
          Search all clients
        </Link>
      </>
    );
  }

  const { data: client } = await supabase
    .from("profiles")
    .select("id, full_name")
    .eq("id", params.clientId)
    .eq("role", "CLIENT")
    .maybeSingle();
  if (!client) {
    return <p className="text-sm text-slate-600">Client not found.</p>;
  }

  const { data: pets } = await supabase
    .from("pets")
    .select("id, name, owner_id")
    .eq("owner_id", client.id)
    .eq("is_archived", false);
  if (!pets?.length) {
    return (
      <p className="text-sm text-slate-600">
        This client has no active pets. Register a pet before creating a walk-in (Phase 3 scope).
      </p>
    );
  }

  const [services, veterinarians] = await Promise.all([
    listBookableServices(supabase),
    listActiveVeterinarians(supabase),
  ]);
  const day = todayIso();

  const defaultSource = params.source === "APPOINTMENT" ? "APPOINTMENT" : "WALK_IN";

  return (
    <>
      <DashboardHeading title="Create booking" subtitle={`For ${client.full_name}.`} />
      <StaffAppointmentForm
        clientId={client.id}
        clientName={client.full_name}
        pets={pets}
        services={services}
        veterinarians={veterinarians}
        day={day}
        defaultSource={defaultSource}
      />
    </>
  );
}
