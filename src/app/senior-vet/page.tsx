import type { Metadata } from "next";
import { DashboardHeading, PlaceholderCard } from "@/components/portal/PlaceholderCard";
import { requireRole } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Senior Vet Dashboard" };

export default async function SeniorVetDashboardPage() {
  const profile = await requireRole(["SENIOR_VET"]);
  const firstName = profile.full_name.split(" ")[0] || "Doc";

  return (
    <>
      <DashboardHeading
        title={`Welcome, ${firstName}!`}
        subtitle="Clinical and administrative overview of the clinic."
      />
      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        <PlaceholderCard
          title="Today's Appointments"
          description="Appointments scheduled for today will appear here."
        />
        <PlaceholderCard
          title="Clinic Overview"
          description="A summary of clinic activity will appear here."
        />
        <PlaceholderCard
          title="Revenue"
          description="Sales and revenue summaries will appear here."
        />
        <PlaceholderCard
          title="Inventory Alerts"
          description="Low-stock and expiring items will appear here."
        />
        <PlaceholderCard
          title="Analytics"
          description="Complete clinic analytics will appear here."
        />
        <PlaceholderCard
          title="User Management"
          description="Manage client and staff accounts here."
        />
        <PlaceholderCard
          title="Clinical Records"
          description="Official clinical and vaccination records will be managed here."
        />
      </div>
    </>
  );
}
