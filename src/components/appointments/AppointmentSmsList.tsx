import { retrySmsAction } from "@/app/actions/sms";
import { buttonClass } from "@/components/ui/button-styles";
import { formatDate } from "@/lib/dates";
import { canManuallyRetry, smsStatusLabel, smsStatusNote } from "@/lib/sms/provider";

export type AppointmentSmsRow = {
  id: string;
  message_type: string;
  status: string;
  provider_status?: string | null;
  schedule_version?: number;
  created_at: string;
  sent_at?: string | null;
  attempt_at?: string | null;
  recipient_phone?: string;
  reference_id?: string | null;
  fail_reason?: string | null;
  error_detail?: string | null;
  retry_count?: number;
  outcome_uncertain?: boolean;
  failure_class?: string;
  content?: string;
};

function typeLabel(type: string): string {
  if (type === "APPOINTMENT_REMINDER") return "Appointment reminder";
  if (type === "RESCHEDULE_NOTIFICATION") return "Reschedule notification";
  return "Message";
}

export function AppointmentSmsList({
  messages,
  audience,
  appointmentId,
  returnTo,
}: {
  messages: AppointmentSmsRow[];
  audience: "client" | "staff";
  appointmentId?: string;
  returnTo?: string;
}) {
  if (messages.length === 0) {
    return <p className="mt-3 text-sm text-muted">No text messages for this appointment yet.</p>;
  }

  return (
    <ul className="mt-4 space-y-3">
      {messages.map((message) => {
        const note = smsStatusNote(message.status, message.provider_status ?? null);
        const retry = audience === "staff" && canManuallyRetry({
          status: message.status,
          failureClass: message.failure_class ?? "none",
          outcomeUncertain: message.outcome_uncertain === true,
          providerStatus: message.provider_status ?? null,
        });
        return (
          <li key={message.id} className="rounded-xl border border-line p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <p className="text-sm font-semibold text-ink">{typeLabel(message.message_type)}</p>
              <p className="text-sm font-medium text-brand">{smsStatusLabel(message.status, message.provider_status ?? null)}</p>
            </div>
            <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs uppercase text-muted">Created</dt>
                <dd>{formatDate(message.created_at)}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase text-muted">Sent</dt>
                <dd>{message.sent_at ? formatDate(message.sent_at) : "—"}</dd>
              </div>
              {audience === "staff" && (
                <>
                  <div>
                    <dt className="text-xs uppercase text-muted">Recipient</dt>
                    <dd>{message.recipient_phone || "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase text-muted">Provider reference</dt>
                    <dd className="break-all">{message.reference_id || "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase text-muted">Retries</dt>
                    <dd>{message.retry_count ?? 0}</dd>
                  </div>
                </>
              )}
            </dl>
            {note && <p className="mt-3 text-sm text-muted">{note}</p>}
            {audience === "staff" && (message.error_detail || message.fail_reason) && (
              <p className="mt-3 text-sm text-accent-dark">{message.error_detail || message.fail_reason}</p>
            )}
            {retry && appointmentId && (
              <form action={retrySmsAction} className="mt-4">
                <input type="hidden" name="smsId" value={message.id} />
                <input type="hidden" name="appointmentId" value={appointmentId} />
                {returnTo && <input type="hidden" name="returnTo" value={returnTo} />}
                <button type="submit" className={buttonClass("outline", "md")}>
                  Retry message
                </button>
              </form>
            )}
          </li>
        );
      })}
    </ul>
  );
}
