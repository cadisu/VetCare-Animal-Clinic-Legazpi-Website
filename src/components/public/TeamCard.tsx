import type { TeamMember } from "@/config/clinic";

function initials(name: string) {
  return name
    .replace(/^Dr\.\s*/i, "")
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

/** PLACEHOLDER team card: initials avatar instead of a real photo. */
export function TeamCard({ member }: { member: TeamMember }) {
  return (
    <article className="h-full rounded-2xl border border-slate-200 bg-white p-6 text-center">
      <div
        className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-brand-muted text-2xl font-bold text-brand"
        role="img"
        aria-label={`Placeholder photo of ${member.name}`}
      >
        {initials(member.name)}
      </div>
      <h3 className="mt-4 text-lg font-semibold">{member.name}</h3>
      <p className="text-sm font-medium text-accent">{member.title}</p>
      <p className="mt-3 text-sm text-slate-600">{member.bio}</p>
    </article>
  );
}
