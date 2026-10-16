import { phoneSchema } from "@/lib/validation/common";

/** UniSMS accepts +639… or 09…. This app sends the +639 form. */
export function toUnisMsRecipient(input: string | null | undefined): string | null {
  if (!input?.trim()) return null;
  const parsed = phoneSchema.safeParse(input);
  if (!parsed.success) return null;
  return `+63${parsed.data.slice(1)}`;
}
