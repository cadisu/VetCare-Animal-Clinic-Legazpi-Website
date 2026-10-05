import type { Metadata } from "next";
import Link from "next/link";
import { DashboardHeading, PlaceholderCard } from "@/components/portal/PlaceholderCard";
import { requireRole } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Staff Dashboard" };

export default async function StaffDashboardPage() {
  const profile = await requireRole(["STAFF", "SENIOR_VET"]);
  const firstName = profile.first_name || "team";

  return (
    <>
      <DashboardHeading
        title={`Welcome, ${firstName}!`}
        subtitle="Today's clinic operations at a glance."
      />
      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        <PlaceholderCard
          title="Today's Appointments"
          description="Appointments scheduled for today will appear here."
        />
        <PlaceholderCard
          title="Walk-ins"
          description="Create and track walk-in visits here."
        />
        <Link
          href="/staff/clients"
          className="rounded-2xl border border-slate-200 bg-white p-6 transition-colors hover:border-brand/40 hover:bg-brand-soft/40"
        >
          <h2 className="text-base font-semibold text-slate-900">Clients</h2>
          <p className="mt-3 text-sm text-slate-600">Search clients and view their pets.</p>
          <p className="mt-4 text-sm font-semibold text-brand">Open clients →</p>
        </Link>
        <PlaceholderCard title="POS" description="Point-of-sale checkout will be available here." />
        <PlaceholderCard
          title="Inventory"
          description="Stock levels and inventory alerts will appear here."
        />
        <PlaceholderCard
          title="Analytics"
          description="Operational analytics will appear here."
        />
      </div>
    </>
  );
}
