import { VisitRecords, type VisitEntry } from "@/components/clinical/VisitRecords";
import { WeightForm } from "@/components/clinical/WeightForm";
import type { VeterinarianRow } from "@/lib/appointments/constants";
import {
  formatWeightKg,
  type ClinicalRecord,
  type RecordableAppointment,
  type VaccinationRecord,
  type WeightRecord,
} from "@/lib/clinical/constants";
import { formatDate } from "@/lib/dates";
import { panelPaddingClass } from "@/components/ui/panel-styles";

function Panel({ title, className = "", children }: { title: string; className?: string; children: React.ReactNode }) {
  return (
    <section className={panelPaddingClass(className)}>
      <h2 className="text-base font-semibold text-ink">{title}</h2>
      {children}
    </section>
  );
}

export function MedicalRecords({
  petId,
  returnTo,
  weights,
  clinical,
  vaccinations,
  canRecordWeight,
  canEditMedical,
  veterinarians = [],
  appointments = [],
  appointmentId,
  defaultVisitDate,
  defaultVeterinarianId,
  initialEntry,
  prompt = false,
  showVisit = true,
  showWeight = true,
}: {
  petId: string;
  returnTo: string;
  weights: WeightRecord[];
  clinical: ClinicalRecord[];
  vaccinations: VaccinationRecord[];
  canRecordWeight: boolean;
  canEditMedical: boolean;
  veterinarians?: VeterinarianRow[];
  appointments?: RecordableAppointment[];
  /** Limits the visit page to one appointment. The pet page omits this. */
  appointmentId?: string;
  defaultVisitDate?: string;
  defaultVeterinarianId?: string | null;
  initialEntry?: VisitEntry;
  prompt?: boolean;
  showVisit?: boolean;
  showWeight?: boolean;
}) {
  const visitWeights = appointmentId ? weights.filter((row) => row.appointment_id === appointmentId) : weights;
  const latest = weights[0];

  return (
    <div className="contents">
      {showWeight && (
        <Panel title="Current weight">
          <p className="mt-3 text-2xl font-semibold text-ink">{latest ? formatWeightKg(latest.weight_kg) : "No weight yet"}</p>
          {latest && (
            <p className="mt-1 text-sm text-muted">
              Recorded {formatDate(latest.recorded_at)} · {latest.source === "MANUAL" ? "Manual entry" : "Scale"}
            </p>
          )}
          {canRecordWeight && (
            <WeightForm
              petId={petId}
              returnTo={returnTo}
              appointmentId={appointmentId}
              appointments={appointmentId ? undefined : appointments}
              defaultWeight={
                latest && Number.isFinite(Number(latest.weight_kg)) ? Number(latest.weight_kg).toFixed(2) : ""
              }
            />
          )}
        </Panel>
      )}

      {showWeight && (
        <Panel title="Weight history">
          {visitWeights.length === 0 ? (
            <p className="mt-3 text-sm text-muted">No weight readings yet.</p>
          ) : (
            <ul className="mt-4 divide-y divide-slate-100">
              {visitWeights.map((row) => (
                <li key={row.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <span className="font-medium text-ink">{formatWeightKg(row.weight_kg)}</span>
                  <span className="text-muted">{formatDate(row.recorded_at)}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      )}

      {showVisit && (
        <VisitRecords
          petId={petId}
          returnTo={returnTo}
          clinical={clinical}
          vaccinations={vaccinations}
          canEditMedical={canEditMedical}
          veterinarians={veterinarians}
          appointments={appointments}
          appointmentId={appointmentId}
          defaultVisitDate={defaultVisitDate}
          defaultVeterinarianId={defaultVeterinarianId}
          latestWeight={latest ? String(latest.weight_kg) : ""}
          initialEntry={initialEntry}
          prompt={prompt}
        />
      )}
    </div>
  );
}
