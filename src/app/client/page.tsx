import type { Metadata } from "next";
import { DashboardHeading, PlaceholderCard } from "@/components/portal/PlaceholderCard";
import { requireRole } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Client Dashboard" };

export default async function ClientDashboardPage() {
  // Re-check on the page itself: layouts are not re-run on every client-side navigation.
  const profile = await requireRole(["CLIENT"]);
  const firstName = profile.full_name.split(" ")[0] || "there";

  return (
    <>
      <DashboardHeading
        title={`Welcome, ${firstName}!`}
        subtitle="Here's an overview of your pets and appointments."
      />
      <div className="grid gap-6 md:grid-cols-2">
        <PlaceholderCard
          title="Upcoming Appointment"
          description="Your next appointment (pet, service, date, time and status) will appear here."
        />
        <PlaceholderCard
          title="My Pets"
          description="The pets you register will be listed here."
        />
        <PlaceholderCard
          title="Loyalty"
          description="Your digital stamp card and available rewards will appear here."
        />
        <PlaceholderCard
          title="Recent Activity"
          description="Your recent appointments and services will appear here."
        />
      </div>
    </>
  );
}
