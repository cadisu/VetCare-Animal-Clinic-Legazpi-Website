export const RESCHEDULABLE_STATUSES = ["PENDING", "CONFIRMED"] as const;

export function canRescheduleAppointment(status: string): boolean {
  return status === "PENDING" || status === "CONFIRMED";
}
