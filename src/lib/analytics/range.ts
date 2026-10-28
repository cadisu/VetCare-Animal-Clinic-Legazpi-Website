import { addDaysIso, endOfMonthIso, isIsoDate, startOfMonthIso, todayIso } from "@/lib/dates";

export const ANALYTICS_PRESETS = ["today", "week", "month", "year", "custom"] as const;
export type AnalyticsPreset = (typeof ANALYTICS_PRESETS)[number];

/** Inclusive calendar days. A full non-leap year is 365; a leap year is 366. */
export const MAX_ANALYTICS_DAYS = 366;

const PRESET_LABELS: Record<AnalyticsPreset, string> = {
  today: "Today",
  week: "This week",
  month: "This month",
  year: "This year",
  custom: "Custom range",
};

export function analyticsPresetLabel(preset: AnalyticsPreset): string {
  return PRESET_LABELS[preset];
}

export function isAnalyticsPreset(value: string): value is AnalyticsPreset {
  return (ANALYTICS_PRESETS as readonly string[]).includes(value);
}

/** Monday is the first day. Sunday belongs to the week that started the previous Monday. */
export function startOfWeekIso(iso: string): string {
  const weekday = new Date(`${iso}T00:00:00Z`).getUTCDay();
  const daysSinceMonday = weekday === 0 ? 6 : weekday - 1;
  return addDaysIso(iso, -daysSinceMonday);
}

export function endOfWeekIso(iso: string): string {
  return addDaysIso(startOfWeekIso(iso), 6);
}

export function startOfYearIso(iso: string): string {
  return `${iso.slice(0, 4)}-01-01`;
}

export function endOfYearIso(iso: string): string {
  return `${iso.slice(0, 4)}-12-31`;
}

export function inclusiveDayCount(from: string, to: string): number {
  const start = Date.parse(`${from}T00:00:00Z`);
  const end = Date.parse(`${to}T00:00:00Z`);
  return Math.round((end - start) / 86_400_000) + 1;
}

export function presetBounds(preset: Exclude<AnalyticsPreset, "custom">, today: string): { from: string; to: string } {
  if (preset === "today") return { from: today, to: today };
  if (preset === "week") return { from: startOfWeekIso(today), to: endOfWeekIso(today) };
  if (preset === "year") return { from: startOfYearIso(today), to: endOfYearIso(today) };
  return { from: startOfMonthIso(today), to: endOfMonthIso(today) };
}

export function resolveAnalyticsRange(input: {
  preset?: string;
  from?: string;
  to?: string;
  today?: string;
}): { ok: true; preset: AnalyticsPreset; from: string; to: string } | { ok: false; message: string } {
  const today = input.today && isIsoDate(input.today) ? input.today : todayIso();
  const requested = input.preset ?? "";
  const preset: AnalyticsPreset = isAnalyticsPreset(requested)
    ? requested
    : input.from || input.to
      ? "custom"
      : "month";

  if (preset !== "custom") {
    return { ok: true, preset, ...presetBounds(preset, today) };
  }

  const from = input.from ?? "";
  const to = input.to ?? "";
  if (!isIsoDate(from) || !isIsoDate(to)) {
    return { ok: false, message: "Choose a valid start and end date." };
  }
  if (from > to) {
    return { ok: false, message: "The start date must be on or before the end date." };
  }
  if (inclusiveDayCount(from, to) > MAX_ANALYTICS_DAYS) {
    return { ok: false, message: "A custom range can cover at most 366 days." };
  }
  return { ok: true, preset: "custom", from, to };
}
