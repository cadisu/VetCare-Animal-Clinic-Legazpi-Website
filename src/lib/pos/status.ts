export const POS_STATUSES = ["OPEN", "COMPLETED", "VOIDED"] as const;
export type PosStatus = (typeof POS_STATUSES)[number];

export const POS_STATUS_LABELS: Record<PosStatus, string> = {
  OPEN: "Open",
  COMPLETED: "Completed",
  VOIDED: "Voided",
};

/** Payment label for a visit, derived from its bills. It is not an appointment status. */
export const PAYMENT_LABELS = ["No bill", "Open bill", "Paid", "Voided"] as const;
export type PaymentLabel = (typeof PAYMENT_LABELS)[number];

export function paymentLabel(statuses: readonly PosStatus[]): PaymentLabel {
  if (statuses.includes("OPEN")) return "Open bill";
  if (statuses.includes("COMPLETED")) return "Paid";
  if (statuses.includes("VOIDED")) return "Voided";
  return "No bill";
}

export function isPosStatus(value: string): value is PosStatus {
  return (POS_STATUSES as readonly string[]).includes(value);
}

/** Visits that may be billed. Check-in alone is too early; cancelled and no-show never are. */
export const BILLABLE_APPOINTMENT_STATUSES = ["IN_CONSULTATION", "COMPLETED"] as const;

export function canBillAppointment(status: string): boolean {
  return (BILLABLE_APPOINTMENT_STATUSES as readonly string[]).includes(status);
}
