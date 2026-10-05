import Link from "next/link";
import { formatAge } from "@/lib/dates";
import { PET_GENDER_LABELS, petCode, speciesLabel, type Pet } from "@/lib/pets/constants";
import { PetAvatar } from "./PetAvatar";

export function PetCard({ pet, href, imageUrl }: { pet: Pet; href: string; imageUrl?: string }) {
  const age = formatAge(pet.birth_date);
  return (
    <Link
      href={href}
      className="flex gap-4 rounded-2xl border border-slate-200 bg-white p-4 transition-colors hover:border-brand/40 hover:bg-brand-soft/40"
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
        <p className="mt-1 text-xs text-slate-400">{petCode(pet.pet_number)}</p>
      </div>
    </Link>
  );
}
