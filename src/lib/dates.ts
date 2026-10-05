/** The clinic's local date, so "today" doesn't depend on the server's timezone. */
const CLINIC_TIME_ZONE = "Asia/Manila";

/** Today's date in the clinic's timezone as YYYY-MM-DD. */
export function todayIso(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: CLINIC_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/** True for a real calendar date in YYYY-MM-DD form (rejects e.g. 2024-02-31). */
export function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

/** e.g. "March 5, 2021". */
export function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value.length === 10 ? `${value}T00:00:00Z` : value);
  return new Intl.DateTimeFormat("en-PH", {
    timeZone: value.length === 10 ? "UTC" : CLINIC_TIME_ZONE,
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(date);
}

/** Human-readable age from a YYYY-MM-DD birth date, e.g. "2 yrs 3 mos" or "5 mos". */
export function formatAge(birthDate: string | null | undefined): string | null {
  if (!birthDate || !isIsoDate(birthDate)) return null;
  const [by, bm, bd] = birthDate.split("-").map(Number);
  const [ty, tm, td] = todayIso().split("-").map(Number);

  let months = (ty - by) * 12 + (tm - bm);
  if (td < bd) months -= 1;
  if (months < 0) return null;

  const years = Math.floor(months / 12);
  const rest = months % 12;
  if (years === 0) {
    if (rest === 0) return "Under 1 mo";
    return `${rest} ${rest === 1 ? "mo" : "mos"}`;
  }
  const yearPart = `${years} ${years === 1 ? "yr" : "yrs"}`;
  return rest ? `${yearPart} ${rest} ${rest === 1 ? "mo" : "mos"}` : yearPart;
}
