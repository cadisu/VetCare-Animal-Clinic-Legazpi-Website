export const DEFAULT_REMINDER_TEMPLATE =
  "Good day! This is a reminder that [Pet Name] has a [Service] appointment at [Clinic Name] on [Date] at [Time]. Please contact us if you need to reschedule.";

export const DEFAULT_RESCHEDULE_TEMPLATE =
  "Good day! [Pet Name]'s [Service] appointment at [Clinic Name] has been rescheduled to [Date] at [Time].";

export const REMINDER_PLACEHOLDERS = ["[Pet Name]", "[Service]", "[Clinic Name]", "[Date]", "[Time]"] as const;

const PLACEHOLDER_PATTERN = /\[(?:Pet Name|Service|Clinic Name|Date|Time)\]/g;
const ANY_BRACKET = /\[[^[\]]*\]/;

export type ReminderValues = {
  petName: string;
  serviceName: string;
  clinicName: string;
  dateLabel: string;
  timeLabel: string;
};

/** Returns an error message when the template cannot be saved. */
export function reminderTemplateError(body: string): string | null {
  const value = body ?? "";
  if (value.trim().length === 0) return "Enter a reminder message.";
  if (value.length > 670) return "The template must be 670 characters or fewer.";
  for (const token of REMINDER_PLACEHOLDERS) {
    if (!value.includes(token)) return `Include the ${token} placeholder.`;
  }
  const stripped = REMINDER_PLACEHOLDERS.reduce((text, token) => text.split(token).join(""), value);
  if (ANY_BRACKET.test(stripped)) return "Remove placeholders that are not supported.";
  return null;
}

/**
 * Substitutes known placeholders from the original template only.
 * Values are inserted as plain text and are not scanned for further placeholders.
 */
export function renderReminderTemplate(template: string, values: ReminderValues): string {
  const replacements: Record<string, string> = {
    "[Pet Name]": values.petName,
    "[Service]": values.serviceName,
    "[Clinic Name]": values.clinicName,
    "[Date]": values.dateLabel,
    "[Time]": values.timeLabel,
  };
  return template.replace(PLACEHOLDER_PATTERN, (token) => replacements[token] ?? token);
}

export function renderedMessageError(content: string): string | null {
  if (content.trim().length === 0) return "The reminder message is empty.";
  if (content.length > 670) return "The rendered reminder is longer than 670 characters.";
  return null;
}

/** A pending visit that still needs acceptance must not be called confirmed. */
export function describesPendingAsConfirmed(
  status: string,
  requiresVetAcceptance: boolean,
  content: string,
): boolean {
  return status === "PENDING" && requiresVetAcceptance && /\bconfirmed\b/i.test(content);
}
