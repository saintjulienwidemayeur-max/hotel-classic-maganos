import { setLanguage } from "@/app/(app)/settings/actions";
import { LANGS, type Lang } from "@/lib/i18n";

/**
 * FR / EN switch for the administrator. Two tiny forms posting to a Server
 * Action, so it works before (and without) JavaScript.
 */
export function LanguageSwitch({ lang, tone = "dark" }: { lang: Lang; tone?: "dark" | "light" }) {
  return (
    <div className="flex items-center gap-1" role="group" aria-label="Langue / Language">
      {LANGS.map((value) => {
        const active = value === lang;
        const base = "rounded px-2 py-1 text-xs font-semibold uppercase transition-colors";
        const style = active
          ? tone === "light"
            ? "bg-white/15 text-white"
            : "bg-ink-900 text-white"
          : tone === "light"
            ? "text-ink-300 hover:text-white"
            : "text-ink-500 hover:text-ink-900";
        return (
          <form key={value} action={setLanguage.bind(null, value)}>
            <button type="submit" aria-pressed={active} className={`${base} ${style}`}>
              {value}
            </button>
          </form>
        );
      })}
    </div>
  );
}
