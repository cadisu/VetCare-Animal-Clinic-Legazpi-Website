import type { Metadata } from "next";
import { DashboardHeading, PlaceholderCard } from "@/components/portal/PlaceholderCard";
import { requireRole } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Staff Dashboard" };

export default async function StaffDashboardPage() {
  const profile = await requireRole(["STAFF", "SENIOR_VET"]);
  const firstName = profile.full_name.split(" ")[0] || "team";

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
        <PlaceholderCard
          title="Clients"
          description="Search clients and view their pets here."
        />
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
