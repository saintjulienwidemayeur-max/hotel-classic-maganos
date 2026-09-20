import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { IconDownload, IconFile } from "@/components/icons";
import { AdminTabs } from "@/components/reports/AdminTabs";
import { RangeBar } from "@/components/reports/RangeBar";
import { KeyTag } from "@/components/ui/KeyTag";
import { Metric } from "@/components/ui/Metric";
import { PageHeader } from "@/components/ui/PageHeader";
import { PaymentBadge } from "@/components/ui/StatusBadge";
import { requireAdmin } from "@/lib/auth";
import { ROOM_TYPE_KEYS } from "@/lib/constants";
import { HOTEL_TZ, zonedLocalToUtc } from "@/lib/datetime";
import { formatDate, formatMoney, formatShortDate, fullName } from "@/lib/format";
import { translator } from "@/lib/i18n";
import { getLang } from "@/lib/lang";
import { resolveRange } from "@/lib/report-range";
import { createClient } from "@/lib/supabase/server";
import type { ReportDay, ReportOutstanding, ReportRoomType, ReportSummary, StayDetail } from "@/lib/types";

export const metadata: Metadata = { title: "Rapports" };

type SearchParams = Promise<{ range?: string; from?: string; to?: string }>;

/** A daily table is only useful for short ranges; longer ones show the totals and the room-type table. */
const DAILY_LIMIT_DAYS = 62;

const percent = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : 0);

export default async function ReportsPage({ searchParams }: { searchParams: SearchParams }) {
  await requireAdmin();
  const range = resolveRange(await searchParams);
  const lang = await getLang();
  const t = translator(lang);
  const supabase = await createClient();

  /** "2026-09-14" -> "14 sept. 2026", read at noon so the hotel's time zone can never shift the date. */
  const dayLabel = (isoDate: string) => formatDate(zonedLocalToUtc(`${isoDate}T12:00`), lang);
  const shortDayLabel = (isoDate: string) => formatShortDate(zonedLocalToUtc(`${isoDate}T12:00`), lang);

  // The report_* functions take the hotel's zone so "a day" means the hotel's day.
  const args = { p_from: range.from, p_to: range.to, p_tz: HOTEL_TZ };
  const showDaily = range.days <= DAILY_LIMIT_DAYS;

  const [summaryRes, typeRes, dailyRes, outstandingRes, unpaidRes] = await Promise.all([
    supabase.rpc("report_summary", args).single(),
    supabase.rpc("report_by_room_type", args),
    showDaily ? supabase.rpc("report_daily", args) : Promise.resolve({ data: [], error: null }),
    supabase.rpc("report_outstanding").single(),
    supabase
      .from("stay_details")
      .select("*")
      .in("status", ["active", "checked_out"])
      .in("payment_status", ["unpaid", "partial"])
      .order("check_in", { ascending: false })
      .limit(15),
  ]);

  for (const result of [summaryRes, typeRes, dailyRes, outstandingRes]) {
    if (result.error) {
      if (result.error.code === "42501") redirect("/dashboard"); // not an administrator
      throw new Error(result.error.message);
    }
  }

  const summary = summaryRes.data as ReportSummary;
  const byType = ((typeRes.data ?? []) as ReportRoomType[]).filter((type) => type.rooms_count > 0 || type.checkins > 0);
  const daily = (dailyRes.data ?? []) as ReportDay[];
  const outstanding = outstandingRes.data as ReportOutstanding;
  const unpaidStays = (unpaidRes.data ?? []) as StayDetail[];
  const totalRooms = range.days > 0 ? Math.round(summary.available_room_nights / range.days) : 0;

  const query = `from=${range.from}&to=${range.to}`;

  return (
    <>
      <PageHeader
        title={t("reports.title")}
        description={t("reports.desc")}
        actions={
          <>
            <Link href={`/reports/export/pdf?${query}`} className="btn-primary" prefetch={false}>
              <IconFile />
              {t("reports.downloadPdf")}
            </Link>
            <Link href={`/reports/export?${query}`} className="btn-secondary" prefetch={false}>
              <IconDownload />
              {t("reports.downloadCsv")}
            </Link>
          </>
        }
      />
      <AdminTabs active="reports" lang={lang} />
      <RangeBar range={range} lang={lang} />

      <p className="mb-3 text-sm text-ink-600">
        {range.from === range.to
          ? t("reports.rangeOneDay", { from: dayLabel(range.from) })
          : t("reports.rangeLine", { from: dayLabel(range.from), to: dayLabel(range.to), n: range.days })}
      </p>

      {/* ---------- headline numbers ---------- */}
      <dl className="panel grid grid-cols-2 divide-x divide-y divide-ink-100 lg:grid-cols-5 lg:divide-y-0">
        <Metric
          label={t("reports.billed")}
          value={formatMoney(summary.billed, lang)}
          note={t("reports.billedNote", { n: summary.checkins })}
        />
        <Metric
          label={t("reports.occupancy")}
          value={`${summary.occupancy_pct}%`}
          note={t("reports.occupancyNote", { a: summary.occupied_room_nights, b: summary.available_room_nights })}
        />
        <Metric
          label={t("reports.avgRate")}
          value={formatMoney(summary.avg_nightly_rate, lang)}
          note={t("reports.avgRateNote", { n: summary.avg_stay_nights })}
        />
        <Metric
          label={t("reports.shortStays")}
          value={summary.short_stays}
          note={t("reports.shortStaysNote", { money: formatMoney(summary.billed_short, lang) })}
        />
        <Metric
          label={t("reports.checkouts")}
          value={summary.checkouts}
          note={summary.cancelled > 0 ? t("reports.cancelledNote", { n: summary.cancelled }) : t("reports.noCancelled")}
        />
      </dl>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        {/* ---------- payments ---------- */}
        <section className="panel p-5">
          <h2 className="font-serif text-lg font-semibold">{t("reports.byPayment")}</h2>
          <p className="mt-1 text-sm text-ink-600">{t("reports.byPaymentDesc")}</p>

          <ul className="mt-4 space-y-4">
            {[
              { label: t("payment.paid"), value: summary.billed_paid, bar: "bg-emerald-500" },
              { label: t("payment.partial"), value: summary.billed_partial, bar: "bg-amber-500" },
              { label: t("payment.unpaid"), value: summary.billed_unpaid, bar: "bg-rose-500" },
            ].map((row) => (
              <li key={row.label}>
                <div className="flex items-baseline justify-between text-sm">
                  <span className="font-medium text-ink-800">{row.label}</span>
                  <span className="tabular-nums text-ink-950">
                    {formatMoney(row.value, lang)}{" "}
                    <span className="text-ink-500">({percent(row.value, summary.billed)}%)</span>
                  </span>
                </div>
                <div className="mt-1.5 h-2 rounded-full bg-ink-100">
                  <div className={`h-2 rounded-full ${row.bar}`} style={{ width: `${percent(row.value, summary.billed)}%` }} />
                </div>
              </li>
            ))}
          </ul>

          <p className="mt-5 border-t border-ink-100 pt-4 text-sm text-ink-700">
            {t("reports.outstandingLine", { n: outstanding.stays, money: formatMoney(outstanding.amount, lang) })}
          </p>
          <p className="mt-1 text-xs text-ink-500">{t("reports.outstandingNote")}</p>
        </section>

        {/* ---------- by room type ---------- */}
        <section className="panel overflow-hidden">
          <div className="p-5 pb-3">
            <h2 className="font-serif text-lg font-semibold">{t("reports.byType")}</h2>
            <p className="mt-1 text-sm text-ink-600">{t("reports.byTypeDesc")}</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[460px] text-left text-sm">
              <thead className="border-y border-ink-100 bg-ink-50 text-xs font-medium text-ink-600">
                <tr>
                  <th scope="col" className="px-5 py-2.5">{t("reports.colType")}</th>
                  <th scope="col" className="px-3 py-2.5 text-right">{t("reports.colRooms")}</th>
                  <th scope="col" className="px-3 py-2.5 text-right">{t("reports.colCheckins")}</th>
                  <th scope="col" className="px-3 py-2.5 text-right">{t("reports.colOccupancy")}</th>
                  <th scope="col" className="px-5 py-2.5 text-right">{t("reports.colBilled")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100 tabular-nums">
                {byType.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-5 py-6 text-center text-ink-600">
                      {t("reports.noRooms")}
                    </td>
                  </tr>
                ) : (
                  byType.map((type) => (
                    <tr key={type.room_type}>
                      <td className="px-5 py-3 font-medium text-ink-950">{t(ROOM_TYPE_KEYS[type.room_type])}</td>
                      <td className="px-3 py-3 text-right">{type.rooms_count}</td>
                      <td className="px-3 py-3 text-right">{type.checkins}</td>
                      <td className="px-3 py-3 text-right">{type.occupancy_pct}%</td>
                      <td className="px-5 py-3 text-right">{formatMoney(type.billed, lang)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {/* ---------- day by day ---------- */}
      <section className="panel mt-6 overflow-hidden">
        <div className="p-5 pb-3">
          <h2 className="font-serif text-lg font-semibold">{t("reports.daily")}</h2>
          <p className="mt-1 text-sm text-ink-600">
            {showDaily ? t("reports.dailyDesc", { n: totalRooms }) : t("reports.dailyTooLong", { n: DAILY_LIMIT_DAYS })}
          </p>
        </div>
        {showDaily ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[460px] text-left text-sm">
              <thead className="border-y border-ink-100 bg-ink-50 text-xs font-medium text-ink-600">
                <tr>
                  <th scope="col" className="px-5 py-2.5">{t("reports.colDate")}</th>
                  <th scope="col" className="px-3 py-2.5 text-right">{t("reports.colCheckins")}</th>
                  <th scope="col" className="px-3 py-2.5 text-right">{t("reports.colCheckouts")}</th>
                  <th scope="col" className="w-2/5 px-5 py-2.5">{t("reports.colOccupied")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100 tabular-nums">
                {daily.map((day) => (
                  <tr key={day.day}>
                    <td className="px-5 py-2.5 text-ink-950">{shortDayLabel(day.day)}</td>
                    <td className="px-3 py-2.5 text-right">{day.checkins}</td>
                    <td className="px-3 py-2.5 text-right">{day.checkouts}</td>
                    <td className="px-5 py-2.5">
                      <div className="flex items-center gap-3">
                        <div className="h-2 flex-1 rounded-full bg-ink-100">
                          <div
                            className="h-2 rounded-full bg-lagoon-500"
                            style={{ width: `${Math.min(100, percent(day.occupied_rooms, totalRooms))}%` }}
                          />
                        </div>
                        <span className="w-8 text-right">{day.occupied_rooms}</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>

      {/* ---------- money to chase ---------- */}
      <section className="panel mt-6">
        <div className="p-5 pb-3">
          <h2 className="font-serif text-lg font-semibold">{t("reports.unpaidTitle")}</h2>
          <p className="mt-1 text-sm text-ink-600">{t("reports.unpaidDesc")}</p>
        </div>
        {unpaidStays.length === 0 ? (
          <p className="border-t border-ink-100 px-5 py-8 text-center text-sm text-ink-600">{t("reports.unpaidEmpty")}</p>
        ) : (
          <ul className="divide-y divide-ink-100 border-t border-ink-100">
            {unpaidStays.map((stay) => (
              <li key={stay.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3.5">
                <KeyTag number={stay.room_number} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-ink-950">{fullName(stay)}</p>
                  <p className="text-xs text-ink-600">
                    {formatShortDate(stay.check_in, lang)} - {formatShortDate(stay.actual_check_out ?? stay.expected_check_out, lang)}
                  </p>
                </div>
                <PaymentBadge status={stay.payment_status} lang={lang} />
                <span className="w-24 text-right text-sm font-medium tabular-nums text-ink-950">
                  {formatMoney(stay.total_amount, lang)}
                </span>
                <Link href={`/stays/${stay.id}/edit`} className="btn-secondary btn-sm">
                  {t("common.open")}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
