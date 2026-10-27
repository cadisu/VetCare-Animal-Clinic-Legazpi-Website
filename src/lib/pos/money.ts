/** Round to peso centavos. */
export function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

export function lineSubtotal(unitPrice: number, quantity: number): number {
  return roundMoney(unitPrice * quantity);
}

/** Discount stays zero. Pass a reward amount only as a display preview; the database calculates the amount due. */
export function transactionTotals(subtotals: number[], rewardAmount = 0): {
  subtotal: number;
  discount: number;
  reward: number;
  total: number;
} {
  const subtotal = roundMoney(subtotals.reduce((sum, amount) => sum + amount, 0));
  const discount = 0;
  const reward = Math.min(Math.max(roundMoney(rewardAmount), 0), subtotal);
  return {
    subtotal,
    discount,
    reward,
    total: roundMoney(subtotal - discount - reward),
  };
}

/** Change due when the customer pays the full total in cash. Null when the cash is short. */
export function cashChange(total: number, tendered: number): number | null {
  const amountDue = roundMoney(total);
  const received = roundMoney(tendered);
  if (received < amountDue) return null;
  return roundMoney(received - amountDue);
}

export function formatPeso(value: number | string | null | undefined): string {
  const amount = typeof value === "number" ? value : Number(value ?? 0);
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
  }).format(Number.isFinite(amount) ? amount : 0);
}

export function formatClinicDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-PH", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}
