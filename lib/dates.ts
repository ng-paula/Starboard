// Shared date helpers for the weekly Timeline view. Kept dependency-free
// (no date-fns/dayjs) since the app only needs local-calendar-day math.

export interface WeekDay {
  iso: string; // "YYYY-MM-DD", local calendar day
  date: Date;
  weekdayShort: string; // "Mon"
  dayNum: number; // 3
  isToday: boolean;
}

// Deliberately NOT toISOString() — that's UTC and can roll the date over
// near midnight depending on the user's timezone. This reads the local
// calendar day the same way the user sees it on screen.
export function toISODate(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function addDays(d: Date, days: number): Date {
  const copy = new Date(d);
  copy.setDate(copy.getDate() + days);
  return copy;
}

// Monday-start week containing `today + offsetWeeks * 7 days`.
export function getWeekDates(offsetWeeks: number, today: Date = new Date()): WeekDay[] {
  const base = addDays(today, offsetWeeks * 7);
  const dayOfWeek = base.getDay(); // 0 = Sun ... 6 = Sat
  const distanceFromMonday = (dayOfWeek + 6) % 7; // Mon -> 0, Sun -> 6
  const monday = addDays(base, -distanceFromMonday);
  const todayIso = toISODate(today);

  return Array.from({ length: 7 }).map((_, i) => {
    const date = addDays(monday, i);
    return {
      iso: toISODate(date),
      date,
      weekdayShort: date.toLocaleDateString(undefined, { weekday: "short" }),
      dayNum: date.getDate(),
      isToday: toISODate(date) === todayIso,
    };
  });
}

export function formatWeekRangeLabel(week: WeekDay[]): string {
  if (week.length === 0) return "";
  const start = week[0].date;
  const end = week[week.length - 1].date;
  const startLabel = start.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  const endLabel = end.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  return `${startLabel} - ${endLabel}`;
}

// Compact badge label for a task's due_date, e.g. "Wed 3".
export function formatShortDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const weekday = date.toLocaleDateString(undefined, { weekday: "short" });
  return `${weekday} ${date.getDate()}`;
}

export function formatDayLabel(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
}
