import { blockDateFormAction, publishSlotsFormAction, unblockDateAction } from "@/app/actions/schedule";
import { DashboardHeading } from "@/components/portal/PlaceholderCard";
import { buttonClass } from "@/components/ui/button-styles";
import { FormField, SelectField } from "@/components/ui/FormField";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { panelPaddingClass } from "@/components/ui/panel-styles";
import { todayIso } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";

export async function ClinicSchedulePanel() {
  const supabase = await createClient();
  const today = todayIso();
  const end = new Date(`${today}T12:00:00Z`);
  end.setUTCDate(end.getUTCDate() + 14);
  const toDefault = end.toISOString().slice(0, 10);

  const { data: blocked } = await supabase
    .from("blocked_dates")
    .select("id, block_date, reason, veterinarian:veterinarians(display_name)")
    .order("block_date", { ascending: true });

  const { data: vets } = await supabase
    .from("veterinarians")
    .select("id, display_name")
    .order("sort_order");

  const { data: clinicHours } = await supabase
    .from("clinic_weekly_hours")
    .select("*")
    .order("day_of_week");

  return (
    <>
      <DashboardHeading title="Schedule configuration" />

      <section className={panelPaddingClass("mt-8")}>
        <h2 className="text-base font-semibold">Publish / generate slots</h2>
        <p className="mt-2 text-sm text-slate-600">
          Creates 60-minute slots from weekly rules (max 60-day window per call).
        </p>
        <form action={publishSlotsFormAction} className="mt-4 flex flex-wrap items-end gap-3">
          <FormField label="From" name="fromDate" type="date" defaultValue={today} required />
          <FormField label="To" name="toDate" type="date" defaultValue={toDefault} required />
          <SubmitButton className="!w-auto">Generate slots</SubmitButton>
        </form>
      </section>

      <section className={panelPaddingClass("mt-8")}>
        <h2 className="text-base font-semibold">Block a date</h2>
        <form action={blockDateFormAction} className="mt-4 space-y-4">
          <FormField label="Date" name="blockDate" type="date" required />
          <SelectField label="Scope" name="veterinarianId" defaultValue="">
            <option value="">Whole clinic</option>
            {(vets ?? []).map((v) => (
              <option key={v.id} value={v.id}>
                {v.display_name} only
              </option>
            ))}
          </SelectField>
          <FormField label="Reason (optional)" name="reason" />
          <SubmitButton className="!w-auto">Add block</SubmitButton>
        </form>
        <ul className="mt-6 space-y-2 text-sm">
          {(blocked ?? []).map((b) => (
            <li key={b.id} className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2">
              <span>
                {b.block_date}{" "}
                {b.veterinarian &&
                typeof b.veterinarian === "object" &&
                "display_name" in b.veterinarian
                  ? `· ${(b.veterinarian as { display_name: string }).display_name}`
                  : "· whole clinic"}
                {b.reason ? ` — ${b.reason}` : ""}
              </span>
              <form action={unblockDateAction}>
                <input type="hidden" name="id" value={b.id} />
                <button type="submit" className={buttonClass("ghost", "md")}>
                  Remove
                </button>
              </form>
            </li>
          ))}
        </ul>
      </section>

      <section className={panelPaddingClass("mt-8")}>
        <h2 className="text-base font-semibold">Clinic weekly hours (seed)</h2>
        <ul className="mt-4 space-y-1 text-sm text-slate-700">
          {(clinicHours ?? []).map((h) => (
            <li key={h.day_of_week}>
              DOW {h.day_of_week}:{" "}
              {h.is_closed ? "Closed" : `${String(h.start_time).slice(0, 5)}–${String(h.end_time).slice(0, 5)}`}
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
