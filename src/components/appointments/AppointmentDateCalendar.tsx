"use client";

import { useMemo, useState } from "react";
import { buttonClass } from "@/components/ui/button-styles";
import { addDaysIso, compareIsoDates, endOfMonthIso, startOfMonthIso, todayIso } from "@/lib/dates";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

type Props = {
  availableDates: Set<string>;
  selectedDate: string;
  onSelectDate: (iso: string) => void;
  minDate: string;
  maxDate: string;
};

function monthLabel(year: number, month: number): string {
  return new Intl.DateTimeFormat("en-PH", { month: "long", year: "numeric" }).format(
    new Date(Date.UTC(year, month - 1, 1)),
  );
}

/** Build grid cells for a month (Sunday-first), including leading/trailing padding. */
function buildMonthGrid(viewMonthStart: string): { iso: string | null; inMonth: boolean }[] {
  const [y, m] = viewMonthStart.split("-").map(Number);
  const firstDow = new Date(Date.UTC(y, m - 1, 1)).getUTCDay();
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const cells: { iso: string | null; inMonth: boolean }[] = [];

  for (let i = 0; i < firstDow; i++) cells.push({ iso: null, inMonth: false });
  for (let d = 1; d <= daysInMonth; d++) {
    const iso = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    cells.push({ iso, inMonth: true });
  }
  while (cells.length % 7 !== 0) cells.push({ iso: null, inMonth: false });
  return cells;
}

export function AppointmentDateCalendar({
  availableDates,
  selectedDate,
  onSelectDate,
  minDate,
  maxDate,
}: Props) {
  const today = todayIso();
  const initialView = selectedDate || (compareIsoDates(today, minDate) >= 0 ? today : minDate);
  const [viewMonthStart, setViewMonthStart] = useState(() => startOfMonthIso(initialView));

  const viewMonthEnd = endOfMonthIso(viewMonthStart);
  const canPrev = compareIsoDates(startOfMonthIso(minDate), viewMonthStart) < 0;
  const canNext = compareIsoDates(viewMonthEnd, maxDate) < 0;

  const cells = useMemo(() => buildMonthGrid(viewMonthStart), [viewMonthStart]);
  const [y, m] = viewMonthStart.split("-").map(Number);

  function goPrevMonth() {
    if (!canPrev) return;
    const prev = new Date(Date.UTC(y, m - 2, 1));
    setViewMonthStart(prev.toISOString().slice(0, 10));
  }

  function goNextMonth() {
    if (!canNext) return;
    const next = new Date(Date.UTC(y, m, 1));
    setViewMonthStart(next.toISOString().slice(0, 10));
  }

  return (
    <div className="mt-4 max-w-md">
      <div className="mb-3 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={goPrevMonth}
          disabled={!canPrev}
          className={buttonClass("outline", "md")}
          aria-label="Previous month"
        >
          ←
        </button>
        <p className="text-sm font-semibold text-slate-900" aria-live="polite">
          {monthLabel(y, m)}
        </p>
        <button
          type="button"
          onClick={goNextMonth}
          disabled={!canNext}
          className={buttonClass("outline", "md")}
          aria-label="Next month"
        >
          →
        </button>
      </div>

      <div role="grid" aria-label={`Calendar for ${monthLabel(y, m)}`} className="grid grid-cols-7 gap-1">
        {WEEKDAYS.map((wd) => (
          <div
            key={wd}
            role="columnheader"
            className="py-1 text-center text-xs font-medium uppercase text-slate-500"
          >
            {wd}
          </div>
        ))}
        {cells.map((cell, idx) => {
          if (!cell.iso) {
            return <div key={`pad-${idx}`} role="gridcell" aria-hidden className="aspect-square" />;
          }
          const iso = cell.iso;
          const inRange = compareIsoDates(iso, minDate) >= 0 && compareIsoDates(iso, maxDate) <= 0;
          const selectable = inRange && availableDates.has(iso);
          const isSelected = iso === selectedDate;
          const isToday = iso === today;

          return (
            <button
              key={iso}
              type="button"
              role="gridcell"
              disabled={!selectable}
              aria-label={iso}
              aria-selected={isSelected}
              aria-disabled={!selectable}
              onClick={() => selectable && onSelectDate(iso)}
              className={`aspect-square rounded-lg text-sm font-medium transition-colors ${
                isSelected
                  ? "bg-brand text-white"
                  : selectable
                    ? "border border-slate-200 bg-white text-slate-900 hover:border-brand/50 hover:bg-brand-soft/40"
                    : "cursor-not-allowed bg-slate-50 text-slate-300"
              } ${isToday && !isSelected ? "ring-2 ring-brand/40 ring-offset-1" : ""}`}
            >
              {Number(iso.slice(8, 10))}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Booking window max date from today + days. */
export function bookingMaxDateIso(windowDays: number): string {
  return addDaysIso(todayIso(), windowDays);
}
