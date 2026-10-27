export type LoyaltyRewardType = "FREE_SERVICE" | "DISCOUNT";
export type LoyaltyGrantStatus = "AVAILABLE" | "REDEEMED" | "EXPIRED" | "REVOKED";
export type CyclePolicy = "RESET_ON_REDEEM" | "CONTINUE";

export type ClientRewardOption = {
  grantId: string;
  name: string;
  description: string | null;
  type: LoyaltyRewardType;
  serviceId: string | null;
  discountAmount: number | null;
  milestone: number;
  expiresAt: string | null;
  heldByTransactionId: string | null;
  heldReference: string | null;
};

export type LoyaltyProgramView = {
  id: string;
  name: string;
  description: string | null;
  stampLimit: number;
  isActive: boolean;
  cyclePolicy: CyclePolicy;
  serviceIds: string[];
};

export type LoyaltyRewardView = {
  id: string;
  name: string;
  description: string | null;
  type: LoyaltyRewardType;
  milestone: number;
  serviceId: string | null;
  discountAmount: number | null;
  isActive: boolean;
  allowRepeat: boolean;
  validityDays: number | null;
};

export type LoyaltyGrantView = {
  id: string;
  name: string;
  description: string | null;
  type: LoyaltyRewardType;
  status: LoyaltyGrantStatus;
  milestone: number;
  serviceId: string | null;
  discountAmount: number | null;
  expiresAt: string | null;
  unlockedAt: string;
};

export type LoyaltyHistoryRow = {
  id: string;
  kind: "EARNED" | "REVERSED" | "REDEEMED" | "RESTORED";
  label: string;
  at: string;
  detail: string | null;
};
