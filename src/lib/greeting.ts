import { HOTEL_TZ } from "./datetime";
import type { MessageKey } from "./i18n";

/** Key of the greeting that fits the hotel's local time of day. */
export function greetingKey(now: Date = new Date()): MessageKey {
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", { hour: "numeric", hour12: false, timeZone: HOTEL_TZ }).format(now)
  ) % 24;
  if (hour < 12) return "welcome.g.morning";
  if (hour < 18) return "welcome.g.afternoon";
  return "welcome.g.evening";
}
