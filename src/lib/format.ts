import { HOTEL_TZ } from "./datetime";
import { DEFAULT_LANG, INTL_LOCALE, type Lang } from "./i18n";

/* ---------- Dates (always displayed in the hotel's time zone) ---------- */

type FormatterKind = "date" | "shortDate" | "time" | "longDate";

const OPTIONS: Record<FormatterKind, Intl.DateTimeFormatOptions> = {
  date: { day: "numeric", month: "short", year: "numeric" },
  shortDate: { day: "numeric", month: "short" },
  time: { hour: "numeric", minute: "2-digit" },
  longDate: { weekday: "long", day: "numeric", month: "long", year: "numeric" },
};

/** Formatters are built once per (language, kind) and reused. */
const cache = new Map<string, Intl.DateTimeFormat>();

function formatter(kind: FormatterKind, lang: Lang): Intl.DateTimeFormat {
  const key = `${lang}:${kind}`;
  let found = cache.get(key);
  if (!found) {
    found = new Intl.DateTimeFormat(INTL_LOCALE[lang] ?? INTL_LOCALE[DEFAULT_LANG], {
      timeZone: HOTEL_TZ,
      ...OPTIONS[kind],
    });
    cache.set(key, found);
  }
  return found;
}

export const formatDate = (iso: string | Date, lang: Lang = DEFAULT_LANG) =>
  formatter("date", lang).format(new Date(iso));
export const formatShortDate = (iso: string | Date, lang: Lang = DEFAULT_LANG) =>
  formatter("shortDate", lang).format(new Date(iso));
export const formatTime = (iso: string | Date, lang: Lang = DEFAULT_LANG) =>
  formatter("time", lang).format(new Date(iso));
export const formatLongDate = (iso: string | Date, lang: Lang = DEFAULT_LANG) =>
  formatter("longDate", lang).format(new Date(iso));
export const formatDateTime = (iso: string | Date, lang: Lang = DEFAULT_LANG) =>
  `${formatShortDate(iso, lang)}, ${formatTime(iso, lang)}`;

/* ---------- Money ---------- */

const CURRENCY = process.env.NEXT_PUBLIC_CURRENCY || "USD";
const moneyCache = new Map<string, Intl.NumberFormat>();

function moneyFormatter(lang: Lang): Intl.NumberFormat {
  const locale = INTL_LOCALE[lang] ?? INTL_LOCALE[DEFAULT_LANG];
  let found = moneyCache.get(locale);
  if (!found) {
    try {
      found = new Intl.NumberFormat(locale, { style: "currency", currency: CURRENCY });
    } catch {
      // Invalid currency code in the env file: fall back rather than crash the page.
      found = new Intl.NumberFormat(locale, { style: "currency", currency: "USD" });
    }
    moneyCache.set(locale, found);
  }
  return found;
}

export const formatMoney = (amount: number, lang: Lang = DEFAULT_LANG) => moneyFormatter(lang).format(amount);

/** "Ana María Pérez" style display name. */
export const fullName = (s: { first_name: string; last_name: string }) => `${s.first_name} ${s.last_name}`;
