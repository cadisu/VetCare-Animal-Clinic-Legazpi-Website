export const AUDIT_ACTIONS = [
  "user_created",
  "user_updated",
  "user_deactivated",
  "user_reactivated",
  "role_changed",
  "clinical_record_created",
  "clinical_record_edited",
  "vaccination_created",
  "vaccination_edited",
  "appointment_slot_changed",
  "appointment_cancelled",
  "inventory_adjusted",
  "loyalty_configuration_changed",
  "reward_redeemed",
  "pos_completed",
  "pos_voided",
] as const;

export const AUDIT_ENTITY_TYPES = [
  "profile",
  "clinical_record",
  "vaccination_record",
  "appointment_slot",
  "appointment",
  "product",
  "loyalty_program",
  "loyalty_reward",
  "loyalty_redemption",
  "pos_transaction",
] as const;

const ACTION_LABELS: Record<string, string> = {
  user_created: "User created",
  user_updated: "User updated",
  user_deactivated: "User deactivated",
  user_reactivated: "User reactivated",
  role_changed: "Role changed",
  clinical_record_created: "Clinical record created",
  clinical_record_edited: "Clinical record edited",
  vaccination_created: "Vaccination created",
  vaccination_edited: "Vaccination edited",
  appointment_slot_changed: "Appointment slot changed",
  appointment_cancelled: "Appointment cancelled",
  inventory_adjusted: "Inventory adjusted",
  loyalty_configuration_changed: "Loyalty configuration changed",
  reward_redeemed: "Reward redeemed",
  pos_completed: "POS transaction completed",
  pos_voided: "POS transaction voided",
};

const ENTITY_LABELS: Record<string, string> = {
  profile: "Account",
  clinical_record: "Clinical record",
  vaccination_record: "Vaccination",
  appointment_slot: "Appointment slot",
  appointment: "Appointment",
  product: "Product",
  loyalty_program: "Loyalty program",
  loyalty_reward: "Loyalty reward",
  loyalty_redemption: "Reward redemption",
  pos_transaction: "POS transaction",
};

export function auditActionLabel(action: string): string {
  return ACTION_LABELS[action] ?? action;
}

export function auditEntityLabel(entityType: string): string {
  return ENTITY_LABELS[entityType] ?? entityType;
}

export function formatAuditTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-PH", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export function formatAuditMetadata(value: unknown): string {
  if (!value || typeof value !== "object" || Array.isArray(value)) return "—";
  const parts = Object.entries(value as Record<string, unknown>)
    .filter(([, entry]) => entry !== null && entry !== undefined && entry !== "")
    .map(([key, entry]) => {
      const shown = typeof entry === "object" ? JSON.stringify(entry) : String(entry);
      return `${key}: ${shown}`;
    });
  return parts.join(", ") || "—";
}
