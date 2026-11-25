"use client";

import { useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { transitionAppointmentStatusAction } from "@/app/actions/appointments";
import { buttonClass } from "@/components/ui/button-styles";
import { ConfirmSubmitButton } from "@/components/ui/ConfirmSubmitButton";
import { Dialog } from "@/components/ui/Dialog";
import type { AppointmentStatus } from "@/lib/appointments/constants";
import type { UserRole } from "@/lib/auth/roles";
import { todayIso } from "@/lib/dates";
import { parseConsultationWeight } from "@/lib/validation/clinical";
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
  slotDate,
  day,
  returnTo,
  petName,
  inline = false,
}: {
  role: Extract<UserRole, "CLIENT" | "STAFF" | "SENIOR_VET">;
  appointmentId: string;
  status: AppointmentStatus;
  slotDate?: string;
  day?: string;
  returnTo?: string;
  petName?: string;
  inline?: boolean;
}) {
  const beforeVisitDay = Boolean(slotDate && slotDate > todayIso());
  const actions = appointmentStatusActions(role, status).filter(
    (action) => !beforeVisitDay || (action !== "check_in" && action !== "no_show"),
  );
  const [cancelOpen, setCancelOpen] = useState(false);
  const [weightOpen, setWeightOpen] = useState(false);
  const [weightError, setWeightError] = useState<string | null>(null);
  const weightRef = useRef<HTMLInputElement>(null);
  if (actions.length === 0) return null;

  const staffCancel = role !== "CLIENT" && actions.includes("cancel");

  return (
    <form
      action={transitionAppointmentStatusAction}
      className={inline ? "contents" : "mt-4 space-y-3 border-t border-slate-200 pt-4"}
    >
      <input type="hidden" name="appointmentId" value={appointmentId} />
      {day && <input type="hidden" name="day" value={day} />}
      {returnTo && <input type="hidden" name="returnTo" value={returnTo} />}
      <div className={inline ? "contents" : "flex flex-wrap gap-2"}>
        {actions.map((action) => {
          const confirmMessage = appointmentActionConfirmMessage(action);
          const label = APPOINTMENT_ACTION_LABELS[action];
          const nextStatus = APPOINTMENT_ACTION_STATUS[action];
          if (action === "cancel" && staffCancel) {
            return (
              <button
                key={action}
                type="button"
                className={buttonClass("outline")}
                onClick={() => setCancelOpen(true)}
              >
                {label}
              </button>
            );
          }
          if (action === "start_consultation") {
            return (
              <button
                key={action}
                type="button"
                className={buttonClass(actionVariant(action))}
                onClick={() => {
                  setWeightError(null);
                  if (weightRef.current) {
                    weightRef.current.disabled = false;
                    weightRef.current.value = "";
                  }
                  setWeightOpen(true);
                }}
              >
                {label}
              </button>
            );
          }
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
      {staffCancel && cancelOpen && (
        <div className={`rounded-xl border border-line bg-canvas p-4 ${inline ? "basis-full" : ""}`}>
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
          <div className="mt-3 flex flex-wrap gap-2">
            <PendingSubmitButton variant="outline" name="nextStatus" value="CANCELLED">
              Confirm cancellation
            </PendingSubmitButton>
            <button type="button" className={buttonClass("ghost")} onClick={() => setCancelOpen(false)}>
              Keep appointment
            </button>
          </div>
        </div>
      )}
      <Dialog
        open={weightOpen}
        title="Weigh the pet"
        onClose={() => setWeightOpen(false)}
      >
        <p className="text-sm text-muted">
          Enter {petName ? `${petName}'s` : "the pet's"} weight before the consultation begins. Skip if the pet cannot be weighed right now. The weight can be recorded later.
        </p>
        <label htmlFor={`consult-weight-${appointmentId}`} className="mt-4 block text-sm font-medium text-ink">
          Weight (kg)
        </label>
        <input
          ref={weightRef}
          id={`consult-weight-${appointmentId}`}
          name="weightKg"
          inputMode="decimal"
          placeholder="0.00"
          className="mt-1.5 min-h-11 w-full rounded-lg border border-line px-3 text-sm"
          onChange={() => setWeightError(null)}
        />
        {weightError && <p className="mt-2 text-sm text-red-700">{weightError}</p>}
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="submit"
            name="nextStatus"
            value="IN_CONSULTATION"
            className={buttonClass("primary")}
            onClick={(event) => {
              const parsed = parseConsultationWeight(weightRef.current?.value ?? "");
              if (!parsed.ok || parsed.kg === null) {
                event.preventDefault();
                setWeightError(parsed.ok ? "Enter a weight between 0.01 and 200 kg." : parsed.message);
              }
            }}
          >
            Confirm
          </button>
          <button
            type="submit"
            name="nextStatus"
            value="IN_CONSULTATION"
            className={buttonClass("outline")}
            onClick={() => {
              if (weightRef.current) weightRef.current.disabled = true;
            }}
          >
            Skip
          </button>
        </div>
      </Dialog>
    </form>
  );
}
