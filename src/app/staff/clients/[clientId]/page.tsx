import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PetCard } from "@/components/pets/PetCard";
import { requireRole } from "@/lib/auth/session";
import { formatDate } from "@/lib/dates";
import { isUuid, PET_COLUMNS, type Pet } from "@/lib/pets/constants";
import { getPetImageUrls } from "@/lib/pets/server";
import { panelPaddingClass } from "@/components/ui/panel-styles";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Client Details" };

function Detail({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-1 text-sm text-slate-900">{value || "—"}</dd>
    </div>
  );
}

export default async function StaffClientPage({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  await requireRole(["STAFF", "SENIOR_VET"]);
  const { clientId } = await params;
  if (!isUuid(clientId)) notFound();

  const supabase = await createClient();
  const [{ data: client }, { data: petRows }] = await Promise.all([
    supabase
      .from("profiles")
      .select(
        "id, full_name, last_name, first_name, middle_name, email, contact_number, address, birthdate, status, created_at",
      )
      .eq("id", clientId)
      .eq("role", "CLIENT")
      .maybeSingle(),
    supabase
      .from("pets")
      .select(PET_COLUMNS)
      .eq("owner_id", clientId)
      .order("is_archived", { ascending: true })
      .order("created_at", { ascending: true }),
  ]);
  if (!client) notFound();

  const pets = (petRows ?? []) as Pet[];
  const imageUrls = await getPetImageUrls(supabase, pets.map((p) => p.image_path));

  return (
    <>
      <Link href="/staff/clients" className="text-sm font-semibold text-brand hover:underline">
        ← Back to Clients
      </Link>

      <section className={panelPaddingClass("mt-4")}>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            {client.full_name || "(no name)"}
          </h1>
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
              client.status === "ACTIVE"
                ? "bg-emerald-50 text-emerald-700"
                : "bg-slate-100 text-slate-600"
            }`}
          >
            {client.status === "ACTIVE" ? "Active" : "Inactive"}
          </span>
        </div>
        <dl className="mt-6 grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
          <Detail label="Last name" value={client.last_name} />
          <Detail label="First name" value={client.first_name} />
          <Detail label="Middle name" value={client.middle_name} />
          <Detail label="Birthdate" value={formatDate(client.birthdate)} />
          <Detail label="Contact no." value={client.contact_number} />
          <Detail label="Email" value={client.email} />
          <div className="sm:col-span-2">
            <Detail label="Address" value={client.address} />
          </div>
          <Detail label="Registered on" value={formatDate(client.created_at)} />
        </dl>
      </section>

      <section className="mt-8">
        <h2 className="mb-4 text-lg font-semibold">Pets ({pets.length})</h2>
        {pets.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-600">
            This client hasn&apos;t registered any pets yet.
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {pets.map((pet) => (
              <PetCard
                key={pet.id}
                pet={pet}
                href={`/staff/pets/${pet.id}`}
                imageUrl={pet.image_path ? imageUrls[pet.image_path] : undefined}
              />
            ))}
          </div>
        )}
      </section>
    </>
  );
}
