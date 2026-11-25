import type { Metadata } from "next";
import { FlashNotice } from "@/components/appointments/FlashNotice";
import { DashboardHeading } from "@/components/portal/PlaceholderCard";
import { SmsTemplateForm } from "@/components/sms/SmsTemplateForm";
import { panelClass } from "@/components/ui/panel-styles";
import { requireRole } from "@/lib/auth/session";
import { DEFAULT_REMINDER_TEMPLATE, DEFAULT_RESCHEDULE_TEMPLATE } from "@/lib/sms/template";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "SMS templates" };

export default async function SmsTemplatesPage({
  searchParams,
}: {
  searchParams: Promise<{ flash?: string; flashError?: string }>;
}) {
  await requireRole(["STAFF", "SENIOR_VET"]);
  const query = await searchParams;
  const supabase = await createClient();
  const [{ data: reminder }, { data: reschedule }] = await Promise.all([
    supabase.rpc("get_sms_reminder_template"),
    supabase.rpc("get_sms_reschedule_template"),
  ]);
  const reminderBody = typeof reminder === "string" && reminder.length > 0 ? reminder : DEFAULT_REMINDER_TEMPLATE;
  const rescheduleBody =
    typeof reschedule === "string" && reschedule.length > 0 ? reschedule : DEFAULT_RESCHEDULE_TEMPLATE;

  return (
    <>
      <DashboardHeading title="SMS templates" />
      <FlashNotice flash={query.flash} flashError={query.flashError} />
      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <section className={panelClass("p-6")}>
          <SmsTemplateForm
            kind="reminder"
            body={reminderBody}
            title="Appointment reminder"
            saveLabel="Save reminder message"
          />
        </section>
        <section className={panelClass("p-6")}>
          <SmsTemplateForm
            kind="reschedule"
            body={rescheduleBody}
            title="Reschedule notification"
            saveLabel="Save reschedule message"
          />
        </section>
      </div>
    </>
  );
}
