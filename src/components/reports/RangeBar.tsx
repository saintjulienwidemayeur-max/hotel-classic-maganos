import Link from "next/link";
import { PRESET_KEYS, type DateRange } from "@/lib/report-range";
import { translator, type Lang } from "@/lib/i18n";

/**
 * Period chooser: quick presets as links, plus a custom from/to form.
 * Both are plain links / a GET form, so the chosen period lives in the URL and the
 * page works (and can be bookmarked or shared) without any client-side JavaScript.
 */
export function RangeBar({ range, lang }: { range: DateRange; lang: Lang }) {
  const t = translator(lang);
  const chip = (active: boolean) =>
    `rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors ${
      active ? "border-ink-900 bg-ink-900 text-white" : "border-ink-200 bg-white text-ink-700 hover:bg-ink-50"
    }`;

  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
      <div className="flex flex-wrap gap-2" role="group" aria-label={t("reports.period")}>
        {(Object.keys(PRESET_KEYS) as Array<keyof typeof PRESET_KEYS>).map((key) => (
          <Link key={key} href={`/reports?range=${key}`} className={chip(range.preset === key)} aria-current={range.preset === key ? "true" : undefined}>
            {t(PRESET_KEYS[key])}
          </Link>
        ))}
      </div>

      <form method="get" action="/reports" className="flex flex-wrap items-end gap-2">
        <input type="hidden" name="range" value="custom" />
        <div>
          <label htmlFor="from" className="label">{t("reports.from")}</label>
          <input id="from" name="from" type="date" required defaultValue={range.from} className="input w-40" />
        </div>
        <div>
          <label htmlFor="to" className="label">{t("reports.to")}</label>
          <input id="to" name="to" type="date" required defaultValue={range.to} className="input w-40" />
        </div>
        <button type="submit" className={range.preset === "custom" ? "btn-primary" : "btn-secondary"}>
          {t("reports.show")}
        </button>
      </form>
    </div>
  );
}
