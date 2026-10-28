import { APPOINTMENT_STATUSES, type AppointmentStatus } from "@/lib/appointments/constants";
import { addDaysIso, compareIsoDates } from "@/lib/dates";
import { roundMoney } from "@/lib/pos/money";

export const RECORDED_SALES_LABEL = "Recorded sales";

export type SalesDay = {
  date: string;
  gross: number;
  discounts: number;
  rewards: number;
  recordedSales: number;
  transactions: number;
};

const EMPTY_DAY = {
  gross: 0,
  discounts: 0,
  rewards: 0,
  recordedSales: 0,
  transactions: 0,
};

/** Every calendar day in the range stays in the series. Quiet days are zero. */
export function zeroFillSalesDays(from: string, to: string, rows: SalesDay[]): SalesDay[] {
  const byDate = new Map(rows.map((row) => [row.date, row]));
  const filled: SalesDay[] = [];
  let cursor = from;
  while (compareIsoDates(cursor, to) <= 0 && filled.length <= 366) {
    filled.push(byDate.get(cursor) ?? { date: cursor, ...EMPTY_DAY });
    if (cursor === to) break;
    cursor = addDaysIso(cursor, 1);
  }
  return filled;
}

export function appointmentStatusTotal(statuses: Record<AppointmentStatus, number>): number {
  return APPOINTMENT_STATUSES.reduce((sum, status) => sum + statuses[status], 0);
}

export function countsAsRegisteredCustomer(role: string): boolean {
  return role === "CLIENT";
}

export function countsAsCompletedSale(status: string): boolean {
  return status === "COMPLETED";
}

export function isWalkInAppointment(source: string): boolean {
  return source === "WALK_IN";
}

export function isCounterBillWithoutClient(clientId: string | null): boolean {
  return clientId === null;
}

export function countsAsNetStamp(event: { eventType: string; status: string }): boolean {
  return event.eventType === "EARNED" && event.status === "ACTIVE";
}

export function countsAsStampReversal(event: { eventType: string }): boolean {
  return event.eventType === "REVERSED";
}

export function countsAsRewardUnlock(status: string): boolean {
  return status !== "REVOKED";
}

export function countsAsRewardRedemption(status: string): boolean {
  return status === "APPLIED";
}

export type ServiceBill = {
  id: string;
  status: string;
  lines: { serviceId: string; subtotal: number }[];
};

/** One completed bill counts once. The amount is the sum of that service's stored line subtotals. */
export function serviceRollup(bills: ServiceBill[], serviceId: string): { transactions: number; recordedAmount: number } {
  const qualifying = bills.filter(
    (bill) => bill.status === "COMPLETED" && bill.lines.some((line) => line.serviceId === serviceId),
  );
  const recordedAmount = qualifying.reduce((sum, bill) => {
    const lineTotal = bill.lines
      .filter((line) => line.serviceId === serviceId)
      .reduce((lineSum, line) => lineSum + line.subtotal, 0);
    return sum + lineTotal;
  }, 0);
  return { transactions: qualifying.length, recordedAmount: roundMoney(recordedAmount) };
}
