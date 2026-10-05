import type { Metadata } from "next";
import Link from "next/link";
import { createPetAction } from "@/app/actions/pets";
import { PetForm } from "@/components/pets/PetForm";
import { DashboardHeading } from "@/components/portal/PlaceholderCard";
import { requireRole } from "@/lib/auth/session";
import { todayIso } from "@/lib/dates";

export const metadata: Metadata = { title: "Register a Pet" };

export default async function NewPetPage() {
  await requireRole(["CLIENT"]);

  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/client/pets" className="text-sm font-semibold text-brand hover:underline">
        ← Back to My Pets
      </Link>
      <div className="mt-4">
        <DashboardHeading title="Register a pet" subtitle="Tell us about your pet." />
      </div>
      <section className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">
        <PetForm action={createPetAction} maxDate={todayIso()} submitLabel="Register pet" />
      </section>
    </div>
  );
}
