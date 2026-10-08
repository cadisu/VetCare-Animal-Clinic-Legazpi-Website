import type { TeamMember } from "@/config/clinic";
import { TeamImage } from "@/components/public/TeamImage";

export function TeamCard({ member }: { member: TeamMember }) {
  return (
    <article className="h-full rounded-2xl border border-slate-200 bg-white p-6 text-center">
      <div className="mx-auto w-fit overflow-hidden rounded-full bg-slate-100">
        <TeamImage name={member.name} />
      </div>
      <h3 className="mt-4 text-lg font-semibold">{member.name}</h3>
      <p className="mt-1 text-sm font-medium text-accent">{member.title}</p>
    </article>
  );
}
