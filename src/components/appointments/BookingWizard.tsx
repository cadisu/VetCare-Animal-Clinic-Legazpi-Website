"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useActionState } from "react";
import {
  bookAppointmentAction,
  fetchBookingAvailabilityAction,
} from "@/app/actions/appointments";
import type { FormState } from "@/app/actions/auth";
import { AppointmentBookingSummary } from "@/components/appointments/AppointmentBookingSummary";
import {
  AppointmentDateCalendar,
  bookingMaxDateIso,
} from "@/components/appointments/AppointmentDateCalendar";
import { Alert } from "@/components/ui/Alert";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { buttonClass } from "@/components/ui/button-styles";
import { BOOKING_WINDOW_DAYS } from "@/lib/appointments/constants";
import type { AvailabilityRow, ServiceRow, VeterinarianRow } from "@/lib/appointments/constants";
import { formatTime12, slotStateLabel, SOURCE_LABELS } from "@/lib/appointments/constants";
import { formatDate, todayIso } from "@/lib/dates";
import type { Pet } from "@/lib/pets/constants";

const initial: FormState = {};

type Props = {
  services: ServiceRow[];
  veterinarians: VeterinarianRow[];
  pets: Pet[];
  initialServiceId: string;
  initialVetId: string | null;
};

export function BookingWizard({
  services,
  veterinarians,
  pets,
  initialServiceId,
  initialVetId,
}: Props) {
  const searchParams = useSearchParams();
  const paramServiceId = searchParams.get("serviceId");
  const paramVetId = searchParams.get("vetId");

  const resolvedInitialService =
    paramServiceId && services.some((s) => s.id === paramServiceId) ? paramServiceId : initialServiceId;

  const [serviceId, setServiceId] = useState(resolvedInitialService);
  const [vetId, setVetId] = useState<string | null>(() => {
    const svc = services.find((s) => s.id === resolvedInitialService);
    if (!svc?.requires_veterinarian) return null;
    if (paramVetId && veterinarians.some((v) => v.id === paramVetId)) return paramVetId;
    return initialVetId;
  });

  const [availability, setAvailability] = useState<AvailabilityRow[]>([]);
  const [loadingAvailability, setLoadingAvailability] = useState(false);
  const [availabilityError, setAvailabilityError] = useState<string | null>(null);

  const [date, setDate] = useState("");
  const [slotId, setSlotId] = useState("");
  const [petId, setPetId] = useState(pets[0]?.id ?? "");

  const [state, formAction] = useActionState(bookAppointmentAction, initial);

  const service = services.find((s) => s.id === serviceId);
  const needsVet = Boolean(service?.requires_veterinarian);
  const minDate = todayIso();
  const maxDate = bookingMaxDateIso(BOOKING_WINDOW_DAYS);

  const loadAvailability = useCallback(async (sid: string, vid: string | null, pid: string) => {
    setLoadingAvailability(true);
    setAvailabilityError(null);
    const result = await fetchBookingAvailabilityAction(sid, vid, pid);
    setLoadingAvailability(false);
    if ("error" in result) {
      setAvailability([]);
      setAvailabilityError(result.error);
      return;
    }
    setAvailability(result.availability);
  }, []);

  useEffect(() => {
    if (!serviceId || !petId) return;
    const svc = services.find((s) => s.id === serviceId);
    const effectiveVet = svc?.requires_veterinarian ? vetId : null;
    if (svc?.requires_veterinarian && !effectiveVet) {
      setAvailability([]);
      return;
    }
    void loadAvailability(serviceId, effectiveVet, petId);
  }, [serviceId, vetId, petId, services, loadAvailability]);

  useEffect(() => {
    if (!date) return;
    const stillValid = availability.some(
      (a) => a.slot_date === date && a.slot_state === "AVAILABLE",
    );
    if (!stillValid) {
      setDate("");
      setSlotId("");
    }
  }, [availability, date]);

  useEffect(() => {
    if (!slotId) return;
    const selected = availability.find((a) => a.slot_id === slotId);
    if (!selected || selected.slot_state !== "AVAILABLE") setSlotId("");
  }, [availability, slotId]);

  const availableDates = useMemo(() => {
    const set = new Set<string>();
    for (const row of availability) {
      if (row.slot_state === "AVAILABLE") set.add(row.slot_date);
    }
    return set;
  }, [availability]);

  const timesForDate = useMemo(
    () => availability.filter((a) => a.slot_date === date),
    [availability, date],
  );

  const selectedSlot = useMemo(
    () => availability.find((a) => a.slot_id === slotId && a.slot_state === "AVAILABLE"),
    [availability, slotId],
  );

  const selectedPet = pets.find((p) => p.id === petId);
  const selectedVet = veterinarians.find((v) => v.id === vetId);

  const bookingReady = Boolean(
    service &&
      petId &&
      selectedSlot &&
      (!needsVet || vetId) &&
      selectedPet,
  );

  const reviewRows = bookingReady
    ? [
        { label: "Service", value: service!.name },
        { label: "Pet", value: selectedPet!.name },
        ...(needsVet && selectedVet
          ? [{ label: "Veterinarian", value: selectedVet.display_name }]
          : []),
        { label: "Date", value: formatDate(date) },
        { label: "Time", value: formatTime12(selectedSlot!.start_time) },
        { label: "Source", value: SOURCE_LABELS.APPOINTMENT },
      ]
    : [];

  function selectService(id: string) {
    setServiceId(id);
    setDate("");
    setSlotId("");
    const svc = services.find((s) => s.id === id);
    if (svc?.requires_veterinarian) {
      setVetId((current) =>
        current && veterinarians.some((v) => v.id === current) ? current : veterinarians[0]?.id ?? null,
      );
    } else {
      setVetId(null);
    }
  }

  function selectVet(id: string) {
    setVetId(id);
    setDate("");
    setSlotId("");
  }

  if (pets.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="text-lg font-semibold">Register a pet first</h2>
        <p className="mt-2 text-sm text-slate-600">
          You need at least one registered pet before booking an appointment.
        </p>
        <Link href="/client/pets/new" className={buttonClass("primary", "md", "mt-4 inline-flex")}>
          Register a pet
        </Link>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-8">
      {state.error && <Alert variant="error">{state.error}</Alert>}

      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="text-base font-semibold">1. Service</h2>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {services.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => selectService(s.id)}
              className={`rounded-xl border p-4 text-left text-sm ${
                serviceId === s.id ? "border-brand bg-brand-soft/50" : "border-slate-200"
              }`}
            >
              <span className="font-semibold">{s.name}</span>
              {s.description && <p className="mt-1 text-slate-600">{s.description}</p>}
            </button>
          ))}
        </div>
        <input type="hidden" name="serviceId" value={serviceId} />
      </section>

      {needsVet && (
        <section className="rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="text-base font-semibold">2. Veterinarian</h2>
          <div className="mt-4 flex flex-wrap gap-2">
            {veterinarians.map((v) => (
              <button
                key={v.id}
                type="button"
                onClick={() => selectVet(v.id)}
                className={buttonClass(vetId === v.id ? "primary" : "outline", "md")}
              >
                {v.display_name}
              </button>
            ))}
          </div>
          {vetId && <input type="hidden" name="veterinarianId" value={vetId} />}
        </section>
      )}

      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="text-base font-semibold">{needsVet ? "3" : "2"}. Pet</h2>
        <select
          name="petId"
          value={petId}
          onChange={(e) => setPetId(e.target.value)}
          className="mt-4 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        >
          {pets.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="text-base font-semibold">{needsVet ? "4" : "3"}. Date</h2>
        {loadingAvailability && (
          <p className="mt-3 text-sm text-slate-600">Loading available dates…</p>
        )}
        {availabilityError && !loadingAvailability && (
          <Alert variant="error">{availabilityError}</Alert>
        )}
        {!loadingAvailability && !availabilityError && availableDates.size === 0 && (
          <p className="mt-3 text-sm text-slate-600">No available dates in the next {BOOKING_WINDOW_DAYS} days.</p>
        )}
        {!loadingAvailability && availableDates.size > 0 && (
          <AppointmentDateCalendar
            availableDates={availableDates}
            selectedDate={date}
            onSelectDate={(iso) => {
              setDate(iso);
              setSlotId("");
            }}
            minDate={minDate}
            maxDate={maxDate}
          />
        )}
      </section>

      {date && !loadingAvailability && (
        <section className="rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="text-base font-semibold">{needsVet ? "5" : "4"}. Time</h2>
          <ul className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {timesForDate.map((t) => {
              const selectable = t.slot_state === "AVAILABLE";
              return (
                <li key={t.slot_id}>
                  <button
                    type="button"
                    disabled={!selectable}
                    onClick={() => setSlotId(t.slot_id)}
                    className={`w-full rounded-xl border px-3 py-3 text-left text-sm ${
                      slotId === t.slot_id
                        ? "border-brand bg-brand-soft/50"
                        : selectable
                          ? "border-slate-200 hover:border-brand/40"
                          : "cursor-not-allowed border-slate-100 bg-slate-50 text-slate-400"
                    }`}
                  >
                    <span className="font-semibold">{formatTime12(t.start_time)}</span>
                    <span className="mt-1 block text-xs">
                      {slotStateLabel(t.slot_state)} · {t.booked_count}/{t.capacity}
                    </span>
                    {t.requires_vet_acceptance && selectable && (
                      <span className="mt-1 block text-xs text-amber-800">Requires vet acceptance</span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
          <input type="hidden" name="slotId" value={slotId} />
        </section>
      )}

      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="text-base font-semibold">{needsVet ? "6" : "5"}. Review and confirm</h2>
        {!bookingReady && (
          <p className="mt-3 text-sm text-slate-600">
            Select a service, pet, date, and available time to review your booking.
          </p>
        )}
        {bookingReady && (
          <div className="mt-4">
            <AppointmentBookingSummary
              rows={reviewRows}
              vetAcceptancePending={Boolean(selectedSlot?.requires_vet_acceptance)}
            />
          </div>
        )}
        <SubmitButton className="mt-4" disabled={!bookingReady}>
          Confirm booking
        </SubmitButton>
      </section>
    </form>
  );
}
