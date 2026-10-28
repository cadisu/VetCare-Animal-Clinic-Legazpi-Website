import { afterEach, describe, expect, it, vi } from "vitest";
import { todayIso } from "@/lib/dates";
import {
  endOfWeekIso,
  endOfYearIso,
  inclusiveDayCount,
  resolveAnalyticsRange,
  startOfWeekIso,
  startOfYearIso,
} from "@/lib/analytics/range";

afterEach(() => {
  vi.useRealTimers();
});

describe("analytics date ranges", () => {
  it("keeps Monday as the first day and Sunday in the previous week", () => {
    expect(startOfWeekIso("2026-10-26")).toBe("2026-10-26");
    expect(endOfWeekIso("2026-10-26")).toBe("2026-11-01");
    expect(startOfWeekIso("2026-10-25")).toBe("2026-10-19");
    expect(endOfWeekIso("2026-11-01")).toBe("2026-11-01");
  });

  it("uses inclusive custom bounds and rejects an inverted or over-long range", () => {
    expect(inclusiveDayCount("2026-10-01", "2026-10-01")).toBe(1);
    expect(resolveAnalyticsRange({ preset: "custom", from: "2026-10-01", to: "2026-10-03", today: "2026-10-29" })).toEqual({
      ok: true,
      preset: "custom",
      from: "2026-10-01",
      to: "2026-10-03",
    });
    expect(resolveAnalyticsRange({ preset: "custom", from: "2026-10-03", to: "2026-10-01", today: "2026-10-29" }).ok).toBe(false);
    expect(resolveAnalyticsRange({ preset: "custom", from: "2028-01-01", to: "2028-12-31", today: "2028-06-01" }).ok).toBe(true);
    expect(inclusiveDayCount("2028-01-01", "2028-12-31")).toBe(366);
    expect(resolveAnalyticsRange({ preset: "custom", from: "2028-01-01", to: "2029-01-01", today: "2028-06-01" }).ok).toBe(false);
  });

  it("builds Manila calendar presets without moving the date across UTC midnight", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-28T16:30:00Z"));
    expect(todayIso()).toBe("2026-10-29");
    expect(resolveAnalyticsRange({ preset: "today" })).toEqual({
      ok: true,
      preset: "today",
      from: "2026-10-29",
      to: "2026-10-29",
    });
    expect(resolveAnalyticsRange({ preset: "week" })).toEqual({
      ok: true,
      preset: "week",
      from: "2026-10-26",
      to: "2026-11-01",
    });
    expect(resolveAnalyticsRange({ preset: "month" })).toEqual({
      ok: true,
      preset: "month",
      from: "2026-10-01",
      to: "2026-10-31",
    });
    expect(startOfYearIso("2026-10-29")).toBe("2026-01-01");
    expect(endOfYearIso("2026-10-29")).toBe("2026-12-31");
    expect(resolveAnalyticsRange({ preset: "year" })).toMatchObject({ from: "2026-01-01", to: "2026-12-31" });
  });
});
