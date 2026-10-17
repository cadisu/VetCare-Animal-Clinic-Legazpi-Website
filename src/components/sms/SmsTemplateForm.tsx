"use client";

import { useActionState, useMemo, useState } from "react";
import { updateSmsTemplateAction } from "@/app/actions/sms";
import type { FormState } from "@/app/actions/auth";
import { Alert } from "@/components/ui/Alert";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { clinic } from "@/config/clinic";
import { reminderTemplateError, renderReminderTemplate } from "@/lib/sms/template";

const initial: FormState = {};

export function SmsTemplateForm({
  kind,
  body,
  title,
  saveLabel,
}: {
  kind: "reminder" | "reschedule";
  body: string;
  title: string;
  saveLabel: string;
}) {
  const [state, formAction] = useActionState(updateSmsTemplateAction, initial);
  const [draft, setDraft] = useState(state.values?.body ?? body);
  const previewError = reminderTemplateError(draft);
  const preview = useMemo(() => {
    if (previewError) return null;
    return renderReminderTemplate(draft, {
      petName: "Mingming",
      serviceName: "Wellness check",
      clinicName: clinic.name || "Clinic name",
      dateLabel: "October 17, 2026",
      timeLabel: "9:00 AM",
    });
  }, [draft, previewError]);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="kind" value={kind} />
      <h3 className="text-base font-semibold text-ink">{title}</h3>
      {state.error && state.values?.kind === kind && <Alert variant="error">{state.error}</Alert>}
      <label className="block text-sm font-medium text-ink" htmlFor={`${kind}-body`}>
        Message
        <textarea
          id={`${kind}-body`}
          name="body"
          required
          rows={6}
          maxLength={670}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          className="mt-1.5 block w-full rounded-lg border border-line px-3 py-2 text-sm"
        />
      </label>
      <p className="text-sm text-muted">
        Required placeholders: [Pet Name], [Service], [Clinic Name], [Date], and [Time]. The saved message must be 670 characters or fewer.
      </p>
      <div className="rounded-xl border border-line bg-canvas p-4">
        <p className="text-xs font-medium uppercase text-muted">Preview</p>
        {preview ? (
          <p className="mt-2 text-sm text-ink">{preview}</p>
        ) : (
          <p className="mt-2 text-sm text-accent-dark">{previewError}</p>
        )}
      </div>
      <SubmitButton className="sm:w-auto" pendingText="Saving...">
        {saveLabel}
      </SubmitButton>
    </form>
  );
}
