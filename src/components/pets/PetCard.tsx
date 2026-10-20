import Link from "next/link";
import { formatAge } from "@/lib/dates";
import { PET_GENDER_LABELS, speciesLabel, type Pet } from "@/lib/pets/constants";
import { PetAvatar } from "./PetAvatar";

export function PetCard({ pet, href, imageUrl }: { pet: Pet; href: string; imageUrl?: string }) {
  const age = formatAge(pet.birth_date);
  return (
    <Link
      href={href}
      className="flex gap-4 rounded-2xl border border-line bg-white p-4 shadow-sm shadow-black/[0.03] transition-colors hover:border-brand/40 hover:bg-highlight/80"
    >
      <PetAvatar url={imageUrl} name={pet.name} />
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <h3 className="truncate text-base font-semibold text-slate-900">{pet.name}</h3>
          {pet.is_archived && (
            <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
              Archived
            </span>
          )}
        </div>
        <p className="mt-0.5 text-sm text-slate-600">
          {speciesLabel(pet)} · {pet.breed}
        </p>
        <p className="mt-0.5 text-sm text-slate-500">
          {PET_GENDER_LABELS[pet.gender]}
          {age ? ` · ${age}` : ""}
        </p>
      </div>
    </Link>
  );
}
