import { formatDateTime, formatTime, fullName } from "@/lib/format";
import { translator, type Lang } from "@/lib/i18n";
import type { StayDetail } from "@/lib/types";
import { KeyTag } from "@/components/ui/KeyTag";
import { StayActions } from "./StayActions";

/**
 * Short worklist used on the administrator's overview.
 *  kind="due"     -> guests leaving today or already overdue
 *  kind="arrival" -> pending bookings that have not checked in yet
 */
export function CompactStayList({
  title,
  description,
  stays,
  emptyText,
  kind,
  dayStart,
  lang,
  canCheckIn = false,
}: {
  title: string;
  description: string;
  stays: StayDetail[];
  emptyText: string;
  kind: "due" | "arrival";
  /** ISO start of today in the hotel's zone; earlier due dates are flagged as overdue. */
  dayStart: string;
  lang: Lang;
  canCheckIn?: boolean;
}) {
  const startMs = new Date(dayStart).getTime();
  const t = translator(lang);

  return (
    <section className="panel">
      <div className="border-b border-ink-100 px-5 py-4">
        <h2 className="font-serif text-lg font-semibold">{title}</h2>
        <p className="text-sm text-ink-600">{description}</p>
      </div>

      {stays.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-ink-600">{emptyText}</p>
      ) : (
        <ul className="divide-y divide-ink-100">
          {stays.map((stay) => {
            const overdue = kind === "due" && new Date(stay.expected_check_out).getTime() < startMs;

            return (
              <li key={stay.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5">
                <div className="flex min-w-0 items-center gap-3">
                  <KeyTag number={stay.room_number} />
                  <div className="min-w-0">
                    <p className="truncate font-medium text-ink-950">{fullName(stay)}</p>
                    <p className={`text-sm ${overdue ? "font-medium text-rose-700" : "text-ink-600"}`}>
                      {kind === "arrival"
                        ? t("dash.arrivesAt", { when: formatDateTime(stay.check_in, lang) })
                        : overdue
                          ? t("dash.overdueSince", { when: formatDateTime(stay.expected_check_out, lang) })
                          : t("dash.dueOutAt", { when: formatTime(stay.expected_check_out, lang) })}
                    </p>
                  </div>
                </div>
                <StayActions stayId={stay.id} status={stay.status} lang={lang} canCheckIn={canCheckIn} />
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
