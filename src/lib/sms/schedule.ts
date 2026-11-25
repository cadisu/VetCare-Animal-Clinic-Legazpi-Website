import { addDaysIso } from "@/lib/dates";

export const CLINIC_TIME_ZONE = "Asia/Manila";

/** 09:00 Asia/Manila is 01:00 UTC. The Philippines does not observe daylight saving. */
export const REMINDER_CRON_UTC = "0 1 * * *";

/** Midnight Asia/Manila is 16:00 UTC. */
export const EXPIRE_CRON_UTC = "0 16 * * *";

export function manilaDateIso(now: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: CLINIC_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function nextManilaDateIso(now: Date): string {
  return addDaysIso(manilaDateIso(now), 1);
}

export function isReminderEligibleStatus(status: string): boolean {
  return status === "PENDING" || status === "CONFIRMED";
}
