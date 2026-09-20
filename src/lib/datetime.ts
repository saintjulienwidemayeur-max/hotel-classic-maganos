/**
 * Time-zone helpers.
 *
 * The database stores timestamps in UTC (timestamptz), but front-desk staff think
 * in the hotel's local time. <input type="datetime-local"> submits a bare
 * "2026-09-18T14:30" with NO zone, so the server must interpret it in the hotel's
 * zone - not in the server's zone (which is usually UTC on hosting platforms).
 * These helpers do that conversion with the built-in Intl API (no dependencies).
 */

/** Resolve the configured zone, falling back to UTC if the value is invalid. */
function resolveTimeZone(candidate: string | undefined): string {
  if (!candidate) return "UTC";
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: candidate });
    return candidate;
  } catch {
    return "UTC";
  }
}

export const HOTEL_TZ = resolveTimeZone(process.env.NEXT_PUBLIC_HOTEL_TIMEZONE);

/** Wall-clock parts of an instant, as seen in `tz`. */
function zonedParts(date: Date, tz: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date);

  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour"),
    minute: get("minute"),
    second: get("second"),
  };
}

/** Offset of `tz` from UTC at the given instant, in milliseconds. */
function offsetMs(date: Date, tz: string): number {
  const p = zonedParts(date, tz);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  const truncated = Math.floor(date.getTime() / 1000) * 1000;
  return asUtc - truncated;
}

/**
 * Convert a "YYYY-MM-DDTHH:mm" wall-clock time in `tz` to the matching UTC instant.
 * Two passes make the result correct across daylight-saving changes.
 */
export function zonedLocalToUtc(local: string, tz: string = HOTEL_TZ): Date {
  const [datePart, timePart = "00:00"] = local.split("T");
  const [y, m, d] = datePart.split("-").map(Number);
  const [hh, mm] = timePart.split(":").map(Number);
  const guess = Date.UTC(y, m - 1, d, hh, mm);

  const firstPass = guess - offsetMs(new Date(guess), tz);
  return new Date(guess - offsetMs(new Date(firstPass), tz));
}

/** Format an instant as "YYYY-MM-DDTHH:mm" in `tz` (the value <input type="datetime-local"> expects). */
export function utcToLocalInput(value: string | Date, tz: string = HOTEL_TZ): string {
  const p = zonedParts(typeof value === "string" ? new Date(value) : value, tz);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}`;
}

/** Start (inclusive) and end (exclusive) of the current day in the hotel's zone, as UTC instants. */
export function todayRangeUtc(tz: string = HOTEL_TZ, now: Date = new Date()) {
  const p = zonedParts(now, tz);
  const pad = (n: number) => String(n).padStart(2, "0");
  const startLocal = `${p.year}-${pad(p.month)}-${pad(p.day)}T00:00`;

  // Build tomorrow's date via UTC arithmetic so month/year rollovers are handled.
  const next = new Date(Date.UTC(p.year, p.month - 1, p.day + 1));
  const endLocal = `${next.getUTCFullYear()}-${pad(next.getUTCMonth() + 1)}-${pad(next.getUTCDate())}T00:00`;

  return { start: zonedLocalToUtc(startLocal, tz), end: zonedLocalToUtc(endLocal, tz) };
}
