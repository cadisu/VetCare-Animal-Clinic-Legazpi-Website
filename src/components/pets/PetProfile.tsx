import Link from "next/link";
import { AppointmentStatusBadge } from "@/components/appointments/AppointmentStatusBadge";
import { PlaceholderCard } from "@/components/portal/PlaceholderCard";
import { formatTime12, type AppointmentListRow } from "@/lib/appointments/constants";
import { formatAge, formatDate } from "@/lib/dates";
import { PET_GENDER_LABELS, petCode, speciesLabel, type Pet } from "@/lib/pets/constants";
import { PetAvatar } from "./PetAvatar";

function Detail({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-1 text-sm text-slate-900">{value}</dd>
    </div>
  );
}

/** Pet profile shared by the Client, Staff and Senior Vet portals (read-only view). */
export function PetProfile({
  pet,
  imageUrl,
  ownerName,
  actions,
  appointmentHistory,
  appointmentsHref,
}: {
  pet: Pet;
  imageUrl?: string;
  /** Shown to Staff/Senior Vet. */
  ownerName?: React.ReactNode;
  actions?: React.ReactNode;
  appointmentHistory?: AppointmentListRow[];
  appointmentsHref?: string;
}) {
  const age = formatAge(pet.birth_date);

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
          <PetAvatar url={imageUrl} name={pet.name} className="size-32 sm:size-40" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{pet.name}</h1>
                  {pet.is_archived && (
                    <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
                      Archived
                    </span>
                  )}
                </div>
                <p className="mt-1 text-sm text-slate-500">{petCode(pet.pet_number)}</p>
              </div>
              {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
            </div>

            <h2 className="sr-only">Basic information</h2>
            <dl className="mt-6 grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
              <Detail label="Species" value={speciesLabel(pet)} />
              <Detail label="Breed" value={pet.breed} />
              <Detail label="Gender" value={PET_GENDER_LABELS[pet.gender]} />
              <Detail
                label="Date of birth"
                value={pet.birth_date ? `${formatDate(pet.birth_date)}${age ? ` (${age})` : ""}` : "Not provided"}
              />
              <Detail label="Color / markings" value={pet.color_markings} />
              <Detail label="Registered on" value={formatDate(pet.created_at)} />
              {ownerName && <Detail label="Owner" value={ownerName} />}
              {pet.is_archived && <Detail label="Archived on" value={formatDate(pet.archived_at)} />}
            </dl>
          </div>
        </div>
      </section>

      <div className="grid gap-6 md:grid-cols-2">
        <PlaceholderCard
          title="Current Weight"
          description="The latest recorded weight from the clinic's smart scale will appear here."
        />
        <PlaceholderCard
          title="Weight History"
          description="A history of weight readings will appear here."
        />
        <PlaceholderCard
          title="Vaccination History"
          description="Vaccinations recorded by the clinic will appear here."
        />
        <PlaceholderCard
          title="Clinical Records"
          description="Consultation and treatment records will appear here."
        />
        {appointmentHistory && appointmentHistory.length > 0 ? (
          <section className="rounded-2xl border border-slate-200 bg-white p-6 md:col-span-2">
            <h2 className="text-base font-semibold text-slate-900">Appointment history</h2>
            <ul className="mt-4 space-y-3">
              {appointmentHistory.map((a) => (
                <li
                  key={a.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-100 px-3 py-2 text-sm"
                >
                  <div>
                    <p className="font-medium">{a.service.name}</p>
                    <p className="text-slate-600">
                      {formatDate(a.slot.slot_date)} · {formatTime12(a.slot.start_time)}
                    </p>
                  </div>
                  <AppointmentStatusBadge status={a.status} />
                </li>
              ))}
            </ul>
            {appointmentsHref && (
              <Link href={appointmentsHref} className="mt-4 inline-block text-sm font-semibold text-brand hover:underline">
                View all appointments
              </Link>
            )}
          </section>
        ) : (
          <PlaceholderCard
            title="Appointment History"
            description="Past and upcoming appointments for this pet will appear here."
          />
        )}
      </div>
    </div>
  );
}
