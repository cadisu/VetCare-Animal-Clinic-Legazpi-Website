"use client";

import { useState } from "react";
import { ClinicalRecordForm } from "@/components/clinical/ClinicalRecordForm";
import { VaccinationForm } from "@/components/clinical/VaccinationForm";
import { buttonClass } from "@/components/ui/button-styles";
import { panelPaddingClass } from "@/components/ui/panel-styles";
import type { VeterinarianRow } from "@/lib/appointments/constants";
import {
  formatWeightKg,
  groupRevisions,
  type ClinicalRecord,
  type RecordableAppointment,
  type VaccinationRecord,
} from "@/lib/clinical/constants";
import { formatDate } from "@/lib/dates";

export type VisitEntry = "clinical" | "vaccination" | "revise";

function clinicalDefaults(record: ClinicalRecord): Record<string, string> {
  return {
    appointmentId: record.appointment_id,
    visitDate: record.visit_date,
    veterinarianId: record.veterinarian_id,
    reasonForVisit: record.reason_for_visit,
    clinicalNotes: record.clinical_notes,
    assessment: record.assessment,
    treatment: record.treatment,
    followUp: record.follow_up ?? "",
  };
}

function vaccinationDefaults(record: VaccinationRecord): Record<string, string> {
  const weight = record.weight_kg === null || record.weight_kg === undefined ? "" : String(record.weight_kg);
  return {
    appointmentId: record.appointment_id ?? "",
    vaccineName: record.vaccine_name,
    administeredOn: record.administered_on,
    dose: record.dose,
    veterinarianId: record.veterinarian_id,
    weightKg: weight,
    nextDueOn: record.next_due_on ?? "",
    notes: record.notes ?? "",
  };
}

export function VisitRecords({
  petId,
  returnTo,
  clinical,
  vaccinations,
  canEditMedical,
  veterinarians = [],
  appointments = [],
  appointmentId,
  defaultVisitDate,
  defaultVeterinarianId,
  latestWeight,
  initialEntry = "clinical",
  prompt = false,
}: {
  petId: string;
  returnTo: string;
  clinical: ClinicalRecord[];
  vaccinations: VaccinationRecord[];
  canEditMedical: boolean;
  veterinarians?: VeterinarianRow[];
  appointments?: RecordableAppointment[];
  appointmentId?: string;
  defaultVisitDate?: string;
  defaultVeterinarianId?: string | null;
  latestWeight?: string;
  initialEntry?: VisitEntry;
  /** Appointment page: point the Senior Vet at the form during and after the visit. */
  prompt?: boolean;
}) {
  const [entry, setEntry] = useState<VisitEntry>(initialEntry);
  const [reviseClinicalId, setReviseClinicalId] = useState<string | null>(null);
  const [reviseVaccinationId, setReviseVaccinationId] = useState<string | null>(null);
  const visitClinical = appointmentId ? clinical.filter((row) => row.appointment_id === appointmentId) : clinical;
  const visitVaccinations = appointmentId
    ? vaccinations.filter((row) => row.appointment_id === appointmentId)
    : vaccinations;
  const clinicalLineages = groupRevisions(visitClinical).sort((a, b) =>
    b.current.visit_date.localeCompare(a.current.visit_date),
  );
  const vaccinationLineages = groupRevisions(visitVaccinations).sort((a, b) =>
    b.current.administered_on.localeCompare(a.current.administered_on),
  );
  const recordedAppointmentIds = new Set(clinical.map((row) => row.appointment_id));
  const openAppointments = appointments.filter((row) => !recordedAppointmentIds.has(row.id));
  const currentClinical = appointmentId
    ? clinicalLineages.find((group) => group.current.appointment_id === appointmentId)?.current
    : undefined;
  const clinicalToRevise =
    clinicalLineages.find((group) => group.current.lineage_id === reviseClinicalId)?.current ??
    (entry === "revise" ? currentClinical : undefined);
  const vaccinationToRevise = vaccinationLineages.find((group) => group.current.lineage_id === reviseVaccinationId)?.current;
  const needsClinical = Boolean(appointmentId) && !currentClinical;
  const showClinicalCreate =
    canEditMedical && entry === "clinical" && !clinicalToRevise && (appointmentId ? needsClinical : openAppointments.length > 0);
  const showRevise = canEditMedical && entry === "revise" && Boolean(clinicalToRevise);
  const showVaccinationForm = canEditMedical && entry === "vaccination" && !vaccinationToRevise;
  const showVaccinationRevise = canEditMedical && entry === "vaccination" && Boolean(vaccinationToRevise);

  function choose(next: VisitEntry, lineageId?: string) {
    setEntry(next);
    setReviseClinicalId(next === "revise" ? lineageId ?? currentClinical?.lineage_id ?? null : null);
    setReviseVaccinationId(next === "vaccination" ? lineageId ?? null : null);
    document.getElementById("visit-record")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <section id="visit-record" className={panelPaddingClass("scroll-mt-24 md:col-span-2")}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-ink">Visit record</h2>
          <p className="mt-1 text-sm text-muted">
            {canEditMedical
              ? "Choose what to record. The veterinarian is selected in the form."
              : "Clinical notes and vaccinations for this pet."}
          </p>
        </div>
        {canEditMedical && (
          <div className="flex flex-wrap gap-2" role="group" aria-label="Record type">
            <button
              type="button"
              className={buttonClass(entry === "clinical" || entry === "revise" ? "primary" : "outline", "md")}
              onClick={() => choose(currentClinical ? "revise" : "clinical", currentClinical?.lineage_id)}
            >
              Clinical record
            </button>
            <button
              type="button"
              className={buttonClass(entry === "vaccination" ? "primary" : "outline", "md")}
              onClick={() => choose("vaccination")}
            >
              Vaccination
            </button>
          </div>
        )}
      </div>

      {prompt && canEditMedical && currentClinical && (
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" className={buttonClass("outline", "md")} onClick={() => choose("revise")}>
            Revise record
          </button>
          <button type="button" className={buttonClass("primary", "md")} onClick={() => choose("vaccination")}>
            Add vaccination
          </button>
        </div>
      )}

      {showClinicalCreate && (
        <ClinicalRecordForm
          petId={petId}
          returnTo={returnTo}
          veterinarians={veterinarians}
          appointments={appointmentId ? undefined : openAppointments}
          appointmentId={appointmentId}
          defaults={{
            visitDate: defaultVisitDate ?? "",
            veterinarianId: defaultVeterinarianId ?? "",
          }}
        />
      )}

      {showRevise && clinicalToRevise && (
        <ClinicalRecordForm
          petId={petId}
          returnTo={returnTo}
          veterinarians={veterinarians}
          appointmentId={clinicalToRevise.appointment_id}
          lineageId={clinicalToRevise.lineage_id}
          defaults={clinicalDefaults(clinicalToRevise)}
        />
      )}

      {showVaccinationForm && (
        <VaccinationForm
          petId={petId}
          returnTo={returnTo}
          veterinarians={veterinarians}
          appointments={appointments}
          appointmentId={appointmentId}
          defaults={{
            administeredOn: defaultVisitDate ?? "",
            veterinarianId: defaultVeterinarianId ?? "",
            weightKg: latestWeight ?? "",
          }}
        />
      )}

      {showVaccinationRevise && vaccinationToRevise && (
        <VaccinationForm
          petId={petId}
          returnTo={returnTo}
          veterinarians={veterinarians}
          appointmentId={vaccinationToRevise.appointment_id ?? undefined}
          lineageId={vaccinationToRevise.lineage_id}
          defaults={vaccinationDefaults(vaccinationToRevise)}
        />
      )}

      <div className="mt-5 overflow-x-auto">
        <table className="w-full min-w-[36rem] text-left text-sm">
          <thead>
            <tr className="border-b border-line text-xs uppercase tracking-wide text-muted">
              <th className="px-2 py-2 font-medium">Date</th>
              <th className="px-2 py-2 font-medium">Type</th>
              <th className="px-2 py-2 font-medium">Summary</th>
              <th className="px-2 py-2 font-medium">Veterinarian</th>
              {canEditMedical && <th className="px-2 py-2 font-medium"> </th>}
            </tr>
          </thead>
          <tbody>
            {clinicalLineages.length === 0 && vaccinationLineages.length === 0 && (
              <tr>
                <td colSpan={canEditMedical ? 5 : 4} className="px-2 py-4 text-muted">
                  No clinical or vaccination records yet.
                </td>
              </tr>
            )}
            {clinicalLineages.map(({ current, previous }) => (
              <tr key={current.lineage_id} className="border-b border-slate-100 align-top">
                <td className="px-2 py-3">{formatDate(current.visit_date)}</td>
                <td className="px-2 py-3">Clinical record</td>
                <td className="px-2 py-3">
                  <p className="font-medium text-ink">{current.reason_for_visit}</p>
                  <p className="mt-1 whitespace-pre-wrap text-slate-700">{current.clinical_notes}</p>
                  <p className="mt-1 text-slate-600">Assessment: {current.assessment}</p>
                  <p className="text-slate-600">Treatment: {current.treatment}</p>
                  {current.follow_up && <p className="text-slate-600">Follow-up: {current.follow_up}</p>}
                  {previous.length > 0 && (
                    <div className="mt-3 space-y-2 border-t border-slate-100 pt-2 text-slate-500">
                      <p className="text-xs font-medium uppercase tracking-wide">Previous versions</p>
                      {previous.map((row) => (
                        <p key={row.id}>
                          Revision {row.revision} · {formatDate(row.visit_date)} · {row.reason_for_visit}
                        </p>
                      ))}
                    </div>
                  )}
                </td>
                <td className="px-2 py-3">{current.veterinarian?.display_name ?? "—"}</td>
                {canEditMedical && (
                  <td className="px-2 py-3">
                    <button
                      type="button"
                      className={buttonClass("outline", "md")}
                      onClick={() => choose("revise", current.lineage_id)}
                    >
                      Revise
                    </button>
                  </td>
                )}
              </tr>
            ))}
            {vaccinationLineages.map(({ current, previous }) => (
              <tr key={current.lineage_id} className="border-b border-slate-100 align-top">
                <td className="px-2 py-3">{formatDate(current.administered_on)}</td>
                <td className="px-2 py-3">Vaccination</td>
                <td className="px-2 py-3">
                  <p className="font-medium text-ink">
                    {current.vaccine_name} · {current.dose}
                  </p>
                  <p className="mt-1 text-slate-600">
                    Weight {formatWeightKg(current.weight_kg)}
                    {current.next_due_on ? ` · Next ${formatDate(current.next_due_on)}` : ""}
                  </p>
                  {current.notes && <p className="mt-1 whitespace-pre-wrap text-slate-600">{current.notes}</p>}
                  {previous.length > 0 && (
                    <div className="mt-3 space-y-2 border-t border-slate-100 pt-2 text-slate-500">
                      <p className="text-xs font-medium uppercase tracking-wide">Previous versions</p>
                      {previous.map((row) => (
                        <p key={row.id}>
                          Revision {row.revision} · {row.vaccine_name} · {row.dose} · {formatDate(row.administered_on)}
                        </p>
                      ))}
                    </div>
                  )}
                </td>
                <td className="px-2 py-3">{current.veterinarian?.display_name ?? "—"}</td>
                {canEditMedical && (
                  <td className="px-2 py-3">
                    <button
                      type="button"
                      className={buttonClass("outline", "md")}
                      onClick={() => choose("vaccination", current.lineage_id)}
                    >
                      Revise
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
