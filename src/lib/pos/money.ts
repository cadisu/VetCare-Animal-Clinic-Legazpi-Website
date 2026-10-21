/** Round to peso centavos. */
export function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

export function lineSubtotal(unitPrice: number, quantity: number): number {
  return roundMoney(unitPrice * quantity);
}

/** Phase 7 keeps discount and reward at zero. Loyalty can fill them later. */
export function transactionTotals(subtotals: number[]): {
  subtotal: number;
  discount: number;
  reward: number;
  total: number;
} {
  const subtotal = roundMoney(subtotals.reduce((sum, amount) => sum + amount, 0));
  const discount = 0;
  const reward = 0;
  return {
    subtotal,
    discount,
    reward,
    total: roundMoney(subtotal - discount - reward),
  };
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
