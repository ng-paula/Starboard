"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { toISODate } from "@/lib/dates";

const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"];

// Small month calendar for picking any day. Monday-first (matching the
// Timeline week), past days disabled, opens on the selected day's month.
export default function MiniCalendar({
  value,
  onPick,
}: {
  value: string | null | undefined;
  onPick: (iso: string) => void;
}) {
  const today = new Date();
  const todayIso = toISODate(today);
  const start = value ? new Date(`${value}T00:00:00`) : today;
  const [month, setMonth] = useState(() => new Date(start.getFullYear(), start.getMonth(), 1));

  const firstWeekday = (month.getDay() + 6) % 7; // Mon = 0
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const cells: (Date | null)[] = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => new Date(month.getFullYear(), month.getMonth(), i + 1)),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const isCurrentMonth = month.getFullYear() === today.getFullYear() && month.getMonth() === today.getMonth();
  const shift = (delta: number) => setMonth((m) => new Date(m.getFullYear(), m.getMonth() + delta, 1));

  return (
    <div className="px-1.5 pb-1 pt-0.5">
      <div className="flex items-center justify-between pb-1.5">
        <button
          type="button"
          onClick={() => shift(-1)}
          disabled={isCurrentMonth}
          aria-label="Previous month"
          className="rounded-md p-1 text-muted hover:bg-canvas hover:text-ink disabled:opacity-30 disabled:hover:bg-transparent"
        >
          <ChevronLeft size={14} />
        </button>
        <span className="text-xs font-semibold text-ink">
          {month.toLocaleDateString(undefined, { month: "long", year: "numeric" })}
        </span>
        <button
          type="button"
          onClick={() => shift(1)}
          aria-label="Next month"
          className="rounded-md p-1 text-muted hover:bg-canvas hover:text-ink"
        >
          <ChevronRight size={14} />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-0.5 text-center">
        {WEEKDAYS.map((d, i) => (
          <span key={i} className="pb-1 text-[10px] font-semibold text-muted">
            {d}
          </span>
        ))}
        {cells.map((date, i) => {
          if (!date) return <span key={i} />;
          const iso = toISODate(date);
          const isPast = iso < todayIso;
          const isSelected = iso === value;
          const isToday = iso === todayIso;
          return (
            <button
              key={i}
              type="button"
              disabled={isPast}
              onClick={() => onPick(iso)}
              aria-label={date.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
              aria-pressed={isSelected}
              className={`h-7 rounded-md text-xs font-medium tabular-nums transition-colors ${
                isSelected
                  ? "bg-ink text-white"
                  : isToday
                  ? "border border-ink/25 text-ink hover:bg-canvas"
                  : isPast
                  ? "text-ink/20"
                  : "text-ink hover:bg-canvas"
              }`}
            >
              {date.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}
