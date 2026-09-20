import { ROOM_TYPE_KEYS } from "@/lib/constants";
import { formatDateTime, formatMoney, fullName } from "@/lib/format";
import { translator, type Lang } from "@/lib/i18n";
import type { StayDetail } from "@/lib/types";
import { KeyTag } from "@/components/ui/KeyTag";
import { PaymentBadge, StatusBadge } from "@/components/ui/StatusBadge";
import { StayActions } from "./StayActions";

/**
 * Desktop: a proper table. Phones: stacked cards (a wide table is unusable on a small screen).
 * Both render from the same data, so search and filters behave identically.
 */
export function StaysTable({
  stays,
  lang,
  canCheckIn = true,
}: {
  stays: StayDetail[];
  lang: Lang;
  canCheckIn?: boolean;
}) {
  const now = Date.now();
  const t = translator(lang);

  /** Pending and cancelled bookings never arrived, so "In" would be misleading. */
  const arrivalLabel = (stay: StayDetail) =>
    stay.status === "pending" || stay.status === "cancelled" ? t("stays.arrives") : t("stays.in");

  /** The departure line: actual time once checked out, otherwise the expected time. */
  const departure = (stay: StayDetail) => {
    if (stay.status === "checked_out" && stay.actual_check_out) {
      return <span>{`${t("stays.left")} ${formatDateTime(stay.actual_check_out, lang)}`}</span>;
    }
    const overdue = stay.status === "active" && new Date(stay.expected_check_out).getTime() < now;
    return (
      <span className={overdue ? "font-medium text-rose-700" : undefined}>
        {`${t("stays.due")} ${formatDateTime(stay.expected_check_out, lang)}`}
        {overdue ? ` (${t("stays.overdue")})` : ""}
      </span>
    );
  };

  /** Total line: nights x price, or one flat short-stay price. */
  const totalLine = (stay: StayDetail) =>
    stay.rate_kind === "short"
      ? t("stays.shortStayTotal", { money: formatMoney(stay.total_amount, lang) })
      : t("stays.forNights", { money: formatMoney(stay.total_amount, lang), n: stay.nights });

  return (
    <>
      {/* ----- md and up: table ----- */}
      <div className="panel hidden overflow-x-auto md:block">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b border-ink-100 bg-ink-50 text-xs font-medium text-ink-600">
            <tr>
              <th scope="col" className="px-4 py-3">{t("stays.col.guest")}</th>
              <th scope="col" className="px-4 py-3">{t("stays.col.room")}</th>
              <th scope="col" className="px-4 py-3">{t("stays.col.stay")}</th>
              <th scope="col" className="px-4 py-3">{t("stays.col.payment")}</th>
              <th scope="col" className="px-4 py-3">{t("stays.col.status")}</th>
              <th scope="col" className="px-4 py-3 text-right">
                <span className="sr-only">{t("stays.col.actions")}</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-100">
            {stays.map((stay) => (
              <tr key={stay.id} className="align-top hover:bg-ink-50/60">
                <td className="px-4 py-3.5">
                  <div className="font-medium text-ink-950">{fullName(stay)}</div>
                  <div className="text-ink-600">{stay.phone}</div>
                  <div className="text-xs text-ink-500">{t("stays.idShort")} {stay.id_number}</div>
                </td>
                <td className="px-4 py-3.5">
                  <KeyTag number={stay.room_number} />
                  <div className="mt-1 text-xs text-ink-600">{t(ROOM_TYPE_KEYS[stay.room_type])}</div>
                </td>
                <td className="px-4 py-3.5 text-ink-700">
                  <div>
                    {arrivalLabel(stay)} {formatDateTime(stay.check_in, lang)}
                  </div>
                  <div className="text-ink-600">{departure(stay)}</div>
                </td>
                <td className="px-4 py-3.5">
                  <PaymentBadge status={stay.payment_status} lang={lang} />
                  <div className="mt-1 text-xs text-ink-600">{totalLine(stay)}</div>
                </td>
                <td className="px-4 py-3.5">
                  <StatusBadge status={stay.status} lang={lang} />
                </td>
                <td className="px-4 py-3.5">
                  <StayActions stayId={stay.id} status={stay.status} lang={lang} canCheckIn={canCheckIn} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ----- below md: cards ----- */}
      <ul className="space-y-3 md:hidden">
        {stays.map((stay) => (
          <li key={stay.id} className="panel p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate font-medium text-ink-950">{fullName(stay)}</div>
                <div className="text-sm text-ink-600">{stay.phone}</div>
                <div className="text-xs text-ink-500">{t("stays.idShort")} {stay.id_number}</div>
              </div>
              <StatusBadge status={stay.status} lang={lang} />
            </div>

            <div className="mt-3 flex items-center gap-3">
              <KeyTag number={stay.room_number} />
              <span className="text-sm text-ink-600">{t(ROOM_TYPE_KEYS[stay.room_type])}</span>
            </div>

            <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
              <div>
                <dt className="text-xs text-ink-500">
                  {stay.status === "pending" || stay.status === "cancelled" ? t("stays.arrives") : t("stays.checkedIn")}
                </dt>
                <dd className="text-ink-800">{formatDateTime(stay.check_in, lang)}</dd>
              </div>
              <div>
                <dt className="text-xs text-ink-500">
                  {stay.status === "checked_out" ? t("stays.left") : t("stays.dueOut")}
                </dt>
                <dd className="text-ink-800">
                  {formatDateTime(
                    stay.status === "checked_out" && stay.actual_check_out ? stay.actual_check_out : stay.expected_check_out,
                    lang
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-ink-500">{t("stays.col.payment")}</dt>
                <dd className="mt-0.5">
                  <PaymentBadge status={stay.payment_status} lang={lang} />
                </dd>
              </div>
              <div>
                <dt className="text-xs text-ink-500">{t("stays.col.total")}</dt>
                <dd className="text-ink-800">{totalLine(stay)}</dd>
              </div>
            </dl>

            <div className="mt-4 border-t border-ink-100 pt-3">
              <StayActions stayId={stay.id} status={stay.status} lang={lang} canCheckIn={canCheckIn} />
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
