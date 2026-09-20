import { HOTEL_TZ } from "./datetime";
import type { MessageKey } from "./i18n";

/**
 * Date ranges for the Reports page. Everything is a plain "YYYY-MM-DD" string in the
 * HOTEL's time zone, which is what the report_* database functions expect.
 */
export type RangePreset = "today" | "7d" | "month" | "last_month" | "custom";

export const PRESET_KEYS: Record<Exclude<RangePreset, "custom">, MessageKey> = {
  today: "reports.today",
  "7d": "reports.7d",
  month: "reports.month",
  last_month: "reports.lastMonth",
};

/** The database rejects longer ranges (366 days). */
export const MAX_RANGE_DAYS = 366;

export interface DateRange {
  preset: RangePreset;
  from: string;
  to: string;
  days: number;
}

export function isIsoDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value; // rejects 2026-02-31
}

/** Today's date (YYYY-MM-DD) as seen in `tz`. */
export function todayIn(tz: string = HOTEL_TZ, now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

export function addDays(date: string, amount: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + amount);
  return d.toISOString().slice(0, 10);
}

/** Number of calendar days from `from` to `to`, both included. */
export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000) + 1;
}

/**
 * Works out the range from the page's URL parameters. Anything missing or invalid falls back
 * to "this month so far", so a mangled link never breaks the page.
 */
export function resolveRange(
  params: { range?: string; from?: string; to?: string },
  tz: string = HOTEL_TZ,
  now: Date = new Date()
): DateRange {
  const today = todayIn(tz, now);
  const monthStart = `${today.slice(0, 7)}-01`;

  let preset: RangePreset = "month";
  let from = monthStart;
  let to = today;

  switch (params.range) {
    case "today":
      preset = "today";
      from = to = today;
      break;
    case "7d":
      preset = "7d";
      from = addDays(today, -6);
      break;
    case "last_month": {
      preset = "last_month";
      const lastDayOfPrevious = addDays(monthStart, -1);
      from = `${lastDayOfPrevious.slice(0, 7)}-01`;
      to = lastDayOfPrevious;
      break;
    }
    case "custom":
      if (isIsoDate(params.from) && isIsoDate(params.to)) {
        let start = params.from;
        let end = params.to;
        if (start > end) [start, end] = [end, start]; // be forgiving if the dates were entered backwards
        if (daysBetween(start, end) > MAX_RANGE_DAYS) start = addDays(end, -(MAX_RANGE_DAYS - 1));
        preset = "custom";
        from = start;
        to = end;
      }
      break;
  }

  return { preset, from, to, days: daysBetween(from, to) };
}
