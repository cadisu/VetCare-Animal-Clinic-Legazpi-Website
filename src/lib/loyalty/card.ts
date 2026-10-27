export type CyclePolicy = "RESET_ON_REDEEM" | "CONTINUE";

export type RewardPreviewLine = {
  itemType: "SERVICE" | "PRODUCT";
  serviceId: string | null;
  unitPrice: number;
  quantity: number;
};

/** Filled flags for a stamp card, capped at the configured limit. */
export function stampSlots(count: number, limit: number): boolean[] {
  const safeLimit = Math.max(1, Math.trunc(limit));
  const filled = Math.min(Math.max(Math.trunc(count), 0), safeLimit);
  return Array.from({ length: safeLimit }, (_, index) => index < filled);
}

/** Next milestone still ahead of the current count, within the stamp limit. */
export function nextMilestone(count: number, milestones: number[], limit: number): number | null {
  const upcoming = milestones
    .filter((milestone) => milestone > count && milestone <= limit)
    .sort((left, right) => left - right);
  return upcoming[0] ?? null;
}

/** Stamps still needed for the next milestone, or to fill the card when every milestone is already met. */
export function stampsRemaining(count: number, milestones: number[], limit: number): number {
  const next = nextMilestone(count, milestones, limit);
  if (next !== null) return next - count;
  if (count < limit) return limit - count;
  return 0;
}

/**
  * Where one new stamp lands.
  * RESET_ON_REDEEM stops at a full card.
  * CONTINUE closes that card and places the stamp as stamp 1 of the next cycle.
  */
export function placeStamp(
  policy: CyclePolicy,
  count: number,
  limit: number,
): { awarded: boolean; count: number; rolledOver: boolean } {
  if (count >= limit) {
    if (policy === "RESET_ON_REDEEM") return { awarded: false, count, rolledOver: false };
    return { awarded: true, count: 1, rolledOver: true };
  }
  return { awarded: true, count: count + 1, rolledOver: false };
}

/** RESET_ON_REDEEM clears the open cycle. CONTINUE keeps the current count. */
export function countAfterRedemption(policy: CyclePolicy, count: number): number {
  return policy === "RESET_ON_REDEEM" ? 0 : count;
}

/** Expiration copied onto a grant at unlock. Later reward edits must not recompute this. */
export function grantExpiresAt(unlockedAt: Date, validityDays: number | null): Date | null {
  if (validityDays === null) return null;
  const expires = new Date(unlockedAt.getTime());
  expires.setUTCDate(expires.getUTCDate() + validityDays);
  return expires;
}

/** Preview of one free unit, or a peso discount capped by the lines it applies to. */
export function previewReward(input: {
  type: "FREE_SERVICE" | "DISCOUNT";
  discountAmount: number | null;
  serviceId: string | null;
  lines: RewardPreviewLine[];
}): number | null {
  const subtotal = input.lines.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0);
  if (input.type === "FREE_SERVICE") {
    const line = input.lines.find((item) => item.itemType === "SERVICE" && item.serviceId === input.serviceId);
    if (!line) return null;
    return Math.min(line.unitPrice, subtotal);
  }
  const configured = input.discountAmount ?? 0;
  if (configured <= 0) return null;
  if (input.serviceId) {
    const base = input.lines
      .filter((item) => item.itemType === "SERVICE" && item.serviceId === input.serviceId)
      .reduce((sum, line) => sum + line.unitPrice * line.quantity, 0);
    if (base <= 0) return null;
    return Math.min(configured, base, subtotal);
  }
  return Math.min(configured, subtotal);
}
