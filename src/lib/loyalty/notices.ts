const LOYALTY_ERROR_PHRASES: Record<string, string> = {
  "Only Senior Vets can change the loyalty program": "senior-only",
  "Only clinic staff can change the loyalty program": "senior-only",
  "Stamp limit is below an active milestone": "stamp-limit",
  "Enter a program name": "program-name",
  "Enter a reward name": "reward-name",
  "Enter a stamp limit from 1 to 36": "stamp-limit",
  "Choose a cycle policy": "cycle-policy",
  "Choose a reward type": "reward-type",
  "Choose the reward service": "reward-service",
  "Choose a clinic service": "reward-service",
  "Enter a discount amount": "discount",
  "Enter a valid number of days": "validity",
  "The description is too long": "description",
  "Not authorized": "senior-only",
};

const LOYALTY_ERROR_TEXT: Record<string, string> = {
  "senior-only": "Only Staff and Senior Vet can change the loyalty program.",
  "stamp-limit": "The stamp limit has to be at least as high as each active milestone, from 1 to 36.",
  "program-name": "Enter a program name.",
  "reward-name": "Enter a reward name.",
  "cycle-policy": "Choose whether redemption resets the card or the card continues.",
  "reward-type": "Choose a free service or a peso discount.",
  "reward-service": "Choose a clinic service for this reward.",
  discount: "Enter a discount greater than zero.",
  validity: "Enter validity as a number of days, or leave it blank.",
  description: "The description is too long.",
  generic: "Something went wrong. Please try again.",
};

const LOYALTY_NOTICE_TEXT: Record<string, string> = {
  saved: "Loyalty settings saved. Existing stamps and rewards were kept.",
  "reward-saved": "Reward saved. Grants already unlocked keep their original validity.",
  "reward-off": "Reward deactivated. Earned stamps and past redemptions stay in the history.",
  "reward-on": "Reward activated.",
};

export function loyaltyErrorCode(message: string): string {
  const phrase = Object.keys(LOYALTY_ERROR_PHRASES).find((item) => message.includes(item));
  return phrase ? LOYALTY_ERROR_PHRASES[phrase] : "generic";
}

export function loyaltyErrorText(code: string | undefined): string | null {
  if (!code) return null;
  return LOYALTY_ERROR_TEXT[code] ?? LOYALTY_ERROR_TEXT.generic;
}

export function loyaltyNoticeText(code: string | undefined): string | null {
  if (!code) return null;
  return LOYALTY_NOTICE_TEXT[code] ?? null;
}
