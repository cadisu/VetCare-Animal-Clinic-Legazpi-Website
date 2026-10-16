import type { Metadata } from "next";
import { FlashNotice } from "@/components/appointments/FlashNotice";
import { ReminderTemplateForm } from "@/components/senior-vet/ReminderTemplateForm";
import { panelClass } from "@/components/ui/panel-styles";
import { DEFAULT_REMINDER_TEMPLATE } from "@/lib/sms/template";
import { requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Reminder message" };

export default async function ReminderTemplatePage({
  searchParams,
}: {
  searchParams: Promise<{ flash?: string; flashError?: string }>;
}) {
  await requireRole(["SENIOR_VET"]);
  const query = await searchParams;
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_sms_reminder_template");
  const body = typeof data === "string" && data.length > 0 ? data : DEFAULT_REMINDER_TEMPLATE;

  return (
    <>
      <h2 className="text-lg font-semibold text-ink">Appointment reminder</h2>
      <p className="mt-1 max-w-2xl text-sm text-muted">
        This text is used for the daily reminder. Changing it does not rewrite messages that were already created.
      </p>
      <FlashNotice flash={query.flash} flashError={query.flashError} />
      <section className={panelClass("mt-6 max-w-2xl p-6")}>
        <ReminderTemplateForm body={body} />
      </section>
    </>
  );
}
