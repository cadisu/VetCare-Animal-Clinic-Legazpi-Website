import type { Metadata } from "next";
import { setSlotBlockedFormAction, setSlotCapacityFormAction } from "@/app/actions/schedule";
import { DashboardHeading } from "@/components/portal/PlaceholderCard";
import { buttonClass } from "@/components/ui/button-styles";
import { FormField } from "@/components/ui/FormField";
import { formatTime12 } from "@/lib/appointments/constants";
import { requireRole } from "@/lib/auth/session";
import { todayIso } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Appointment Slots" };

export default async function StaffSlotsPage({
  searchParams,
}: {
  searchParams: Promise<{ day?: string }>;
}) {
  const profile = await requireRole(["STAFF", "SENIOR_VET"]);
  const day = (await searchParams).day ?? todayIso();
  const supabase = await createClient();
  await supabase.rpc("ensure_slots", { p_from: day, p_to: day });

  const { data: slots } = await supabase
    .from("appointment_slots")
    .select(
      "id, slot_date, start_time, capacity, is_blocked, requires_vet_acceptance, veterinarian:veterinarians(display_name)",
    )
    .eq("slot_date", day)
    .order("start_time")
    .order("veterinarian_id", { nullsFirst: true });

  const slotIds = (slots ?? []).map((s) => s.id);
  const { data: counts } = slotIds.length
    ? await supabase
        .from("appointments")
        .select("slot_id")
        .in("slot_id", slotIds)
        .neq("status", "CANCELLED")
    : { data: [] };
  const bookedMap = new Map<string, number>();
  for (const row of counts ?? []) {
    bookedMap.set(row.slot_id, (bookedMap.get(row.slot_id) ?? 0) + 1);
  }

  return (
    <>
      <DashboardHeading title="Slot management" subtitle="Block times or adjust capacity (Senior Vet only)." />
      <form method="get" className="mt-4 flex items-end gap-3">
        <FormField label="Date" name="day" type="date" defaultValue={day} />
        <button type="submit" className={buttonClass("secondary", "md")}>
          Load
        </button>
      </form>

      <div className="mt-8 overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Time</th>
              <th className="px-4 py-3">Lane</th>
              <th className="px-4 py-3">Booked</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {(slots ?? []).map((slot) => {
              const booked = bookedMap.get(slot.id) ?? 0;
              const vetRaw = slot.veterinarian as unknown;
              const vet = Array.isArray(vetRaw) ? vetRaw[0] : vetRaw;
              const vetName =
                vet && typeof vet === "object" && "display_name" in vet
                  ? String((vet as { display_name: string }).display_name)
                  : null;
              const lane = vetName ?? "Clinic (grooming)";
              return (
                <tr key={slot.id} className="border-b border-slate-100">
                  <td className="px-4 py-3">{formatTime12(String(slot.start_time))}</td>
                  <td className="px-4 py-3">{lane}</td>
                  <td className="px-4 py-3">
                    {booked}/{slot.capacity}
                  </td>
                  <td className="px-4 py-3">
                    {slot.is_blocked ? "BLOCKED" : booked >= slot.capacity ? "FULL" : "OPEN"}
                    {slot.requires_vet_acceptance && " · vet acceptance"}
                  </td>
                  <td className="px-4 py-3">
                    <form action={setSlotBlockedFormAction} className="inline">
                      <input type="hidden" name="slotId" value={slot.id} />
                      <input type="hidden" name="day" value={day} />
                      <input
                        type="hidden"
                        name="isBlocked"
                        value={slot.is_blocked ? "false" : "true"}
                      />
                      <button type="submit" className={buttonClass("outline", "md")}>
                        {slot.is_blocked ? "Unblock" : "Block"}
                      </button>
                    </form>
                    {profile.role === "SENIOR_VET" && (
                      <form action={setSlotCapacityFormAction} className="ml-2 inline-flex items-center gap-1">
                        <input type="hidden" name="slotId" value={slot.id} />
                        <input type="hidden" name="day" value={day} />
                        <input
                          name="capacity"
                          type="number"
                          min={1}
                          max={50}
                          defaultValue={slot.capacity}
                          className="w-16 rounded border border-slate-300 px-2 py-1 text-xs"
                        />
                        <button type="submit" className={buttonClass("ghost", "md")}>
                          Set cap
                        </button>
                      </form>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
