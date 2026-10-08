import type { Metadata } from "next";
import { team } from "@/config/clinic";
import { PageHeader } from "@/components/public/PageHeader";
import { TeamCard } from "@/components/public/TeamCard";

export const metadata: Metadata = { title: "Meet Our Veterinary Team" };

export default function VeterinaryTeamPage() {
  return (
    <>
      <PageHeader
        title="Meet Our Veterinary Team"
        description="The people who care for your pets every day."
      />
      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-16 lg:px-8">
        <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {team.map((member) => (
            <li key={member.name}>
              <TeamCard member={member} />
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
