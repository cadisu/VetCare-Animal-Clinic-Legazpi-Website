"use client";

import { useFormStatus } from "react-dom";
import { transitionAppointmentStatusAction } from "@/app/actions/appointments";
import { buttonClass } from "@/components/ui/button-styles";
import { ConfirmSubmitButton } from "@/components/ui/ConfirmSubmitButton";
import type { AppointmentStatus } from "@/lib/appointments/constants";
import type { UserRole } from "@/lib/auth/roles";
import {
  APPOINTMENT_ACTION_LABELS,
  APPOINTMENT_ACTION_STATUS,
  appointmentActionConfirmMessage,
  appointmentStatusActions,
  type AppointmentStatusAction,
} from "@/lib/appointments/transitions";

function PendingSubmitButton({
  children,
  variant,
  name,
  value,
}: {
  children: React.ReactNode;
  variant: "primary" | "secondary" | "outline";
  name: string;
  value: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      name={name}
      value={value}
      disabled={pending}
      aria-busy={pending}
      className={buttonClass(variant)}
    >
      {pending ? "Please wait..." : children}
    </button>
  );
}

function actionVariant(action: AppointmentStatusAction): "primary" | "secondary" | "outline" {
  if (action === "confirm") return "primary";
  if (action === "cancel" || action === "no_show") return "outline";
  return "secondary";
}

export function AppointmentStatusActions({
  role,
  appointmentId,
  status,
  day,
  returnTo,
}: {
  role: Extract<UserRole, "CLIENT" | "STAFF" | "SENIOR_VET">;
  appointmentId: string;
  status: AppointmentStatus;
  day?: string;
  returnTo?: string;
}) {
  const actions = appointmentStatusActions(role, status);
  if (actions.length === 0) return null;

  const showReason = role !== "CLIENT" && actions.includes("cancel");

  return (
    <form action={transitionAppointmentStatusAction} className="mt-4 space-y-3 border-t border-slate-200 pt-4">
      <input type="hidden" name="appointmentId" value={appointmentId} />
      {day && <input type="hidden" name="day" value={day} />}
      {returnTo && <input type="hidden" name="returnTo" value={returnTo} />}
      {showReason && (
        <div>
          <label htmlFor={`cancel-reason-${appointmentId}`} className="mb-1.5 block text-sm font-medium text-ink">
            Cancellation reason <span className="font-normal text-muted">(optional)</span>
          </label>
          <input
            id={`cancel-reason-${appointmentId}`}
            name="reason"
            maxLength={500}
            onKeyDown={(event) => {
              if (event.key === "Enter") event.preventDefault();
            }}
            className="min-h-11 w-full rounded-lg border border-line px-3 text-sm"
          />
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        {actions.map((action) => {
          const confirmMessage = appointmentActionConfirmMessage(action);
          const label = APPOINTMENT_ACTION_LABELS[action];
          const nextStatus = APPOINTMENT_ACTION_STATUS[action];
          if (confirmMessage) {
            return (
              <ConfirmSubmitButton
                key={action}
                confirmMessage={confirmMessage}
                variant={actionVariant(action)}
                name="nextStatus"
                value={nextStatus}
              >
                {label}
              </ConfirmSubmitButton>
            );
          }
          return (
            <PendingSubmitButton key={action} variant={actionVariant(action)} name="nextStatus" value={nextStatus}>
              {label}
            </PendingSubmitButton>
          );
        })}
      </div>
    </form>
  );
}
