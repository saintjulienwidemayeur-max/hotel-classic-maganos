import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { PAYMENT_STATUS_KEYS, RATE_KIND_KEYS, ROOM_TYPE_KEYS } from "@/lib/constants";
import { HOTEL_TZ, utcToLocalInput, zonedLocalToUtc } from "@/lib/datetime";
import { formatDate, formatMoney, fullName } from "@/lib/format";
import { translator } from "@/lib/i18n";
import { getLang } from "@/lib/lang";
import { PdfDocument } from "@/lib/pdf";
import { addDays, resolveRange } from "@/lib/report-range";
import { createClient } from "@/lib/supabase/server";
import type { ReportDay, ReportRoomType, ReportSummary, StayDetail } from "@/lib/types";

/** Upper bound so a report can never grow without limit. */
const MAX_ROWS = 2_000;
const DAILY_LIMIT_DAYS = 62;

/**
 * GET /reports/export/pdf?from=YYYY-MM-DD&to=YYYY-MM-DD
 *
 * The same report as the screen, as a PDF the administrator can file or print:
 * headline figures, billing by payment status, room types, day by day, and the
 * list of stays in the period. Administrators only.
 */
export async function GET(request: Request) {
  const { profile } = await getSession();
  if (!profile || profile.role !== "admin") {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const lang = await getLang();
  const t = translator(lang);

  const url = new URL(request.url);
  const range = resolveRange({
    range: "custom",
    from: url.searchParams.get("from") ?? undefined,
    to: url.searchParams.get("to") ?? undefined,
  });

  const supabase = await createClient();
  const args = { p_from: range.from, p_to: range.to, p_tz: HOTEL_TZ };
  const showDaily = range.days <= DAILY_LIMIT_DAYS;

  const start = zonedLocalToUtc(`${range.from}T00:00`, HOTEL_TZ);
  const end = zonedLocalToUtc(`${addDays(range.to, 1)}T00:00`, HOTEL_TZ);

  const [summaryRes, typeRes, dailyRes, staysRes] = await Promise.all([
    supabase.rpc("report_summary", args).single(),
    supabase.rpc("report_by_room_type", args),
    showDaily ? supabase.rpc("report_daily", args) : Promise.resolve({ data: [], error: null }),
    supabase
      .from("stay_details")
      .select("*")
      .gte("check_in", start.toISOString())
      .lt("check_in", end.toISOString())
      .order("check_in", { ascending: true })
      .limit(MAX_ROWS),
  ]);

  if (summaryRes.error) {
    // 42501 = the database refused: not an administrator.
    return new NextResponse("Forbidden", { status: summaryRes.error.code === "42501" ? 403 : 500 });
  }

  const summary = summaryRes.data as ReportSummary;
  const byType = ((typeRes.data ?? []) as ReportRoomType[]).filter((type) => type.rooms_count > 0 || type.checkins > 0);
  const daily = (dailyRes.data ?? []) as ReportDay[];
  const stays = (staysRes.data ?? []) as StayDetail[];

  const dayLabel = (isoDate: string) => formatDate(zonedLocalToUtc(`${isoDate}T12:00`), lang);
  const stamp = (iso: string | null) => (iso ? utcToLocalInput(iso).replace("T", " ") : "");
  const money = (value: number) => formatMoney(value, lang);

  /* ------------------------------ build the PDF ------------------------------ */

  const doc = new PdfDocument((page, total) => t("reports.pdfPage", { a: page, b: total }));

  doc.title(
    `${t("reports.pdfTitle")} - ${t("app.hotel")} ${t("app.subtitle")}`,
    range.from === range.to
      ? t("reports.rangeOneDay", { from: dayLabel(range.from) })
      : t("reports.rangeLine", { from: dayLabel(range.from), to: dayLabel(range.to), n: range.days })
  );

  doc.metrics([
    { label: t("reports.billed"), value: money(summary.billed), note: t("reports.billedNote", { n: summary.checkins }) },
    { label: t("reports.occupancy"), value: `${summary.occupancy_pct}%`, note: t("reports.occupancyNote", { a: summary.occupied_room_nights, b: summary.available_room_nights }) },
    { label: t("reports.avgRate"), value: money(summary.avg_nightly_rate), note: t("reports.avgRateNote", { n: summary.avg_stay_nights }) },
    { label: t("reports.shortStays"), value: String(summary.short_stays), note: t("reports.shortStaysNote", { money: money(summary.billed_short) }) },
    { label: t("reports.checkouts"), value: String(summary.checkouts), note: summary.cancelled > 0 ? t("reports.cancelledNote", { n: summary.cancelled }) : t("reports.noCancelled") },
  ]);

  // ---- payments
  doc.heading(t("reports.byPayment"));
  doc.table(
    [
      { header: t("stays.col.payment"), width: 3 },
      { header: t("reports.colBilled"), width: 2, align: "right" },
    ],
    [
      [t("payment.paid"), money(summary.billed_paid)],
      [t("payment.partial"), money(summary.billed_partial)],
      [t("payment.unpaid"), money(summary.billed_unpaid)],
    ]
  );

  // ---- room types
  doc.heading(t("reports.byType"));
  doc.table(
    [
      { header: t("reports.colType"), width: 2 },
      { header: t("reports.colRooms"), width: 1, align: "right" },
      { header: t("reports.colCheckins"), width: 1, align: "right" },
      { header: t("reports.colOccupancy"), width: 1, align: "right" },
      { header: t("reports.colBilled"), width: 2, align: "right" },
    ],
    byType.length === 0
      ? [[t("reports.noRooms"), "", "", "", ""]]
      : byType.map((type) => [
          t(ROOM_TYPE_KEYS[type.room_type]),
          String(type.rooms_count),
          String(type.checkins),
          `${type.occupancy_pct}%`,
          money(type.billed),
        ])
  );

  // ---- day by day
  if (showDaily && daily.length > 0) {
    doc.heading(t("reports.daily"));
    doc.table(
      [
        { header: t("reports.colDate"), width: 2 },
        { header: t("reports.colCheckins"), width: 1, align: "right" },
        { header: t("reports.colCheckouts"), width: 1, align: "right" },
        { header: t("reports.colOccupied"), width: 1, align: "right" },
      ],
      daily.map((day) => [dayLabel(day.day), String(day.checkins), String(day.checkouts), String(day.occupied_rooms)])
    );
  }

  // ---- the stays themselves
  doc.heading(t("reports.pdfStays"));
  if (stays.length === 0) {
    doc.paragraph(t("reports.pdfNoStays"));
  } else {
    doc.table(
      [
        { header: t("reports.colGuest"), width: 3 },
        { header: t("reports.colRoom"), width: 1 },
        { header: t("reports.colCheckIn"), width: 2 },
        { header: t("reports.colCheckOut"), width: 2 },
        { header: t("reports.colRate"), width: 1.4 },
        { header: t("reports.colPayment"), width: 1.4 },
        { header: t("reports.colTotal"), width: 1.6, align: "right" },
      ],
      stays.map((stay) => [
        fullName(stay),
        stay.room_number,
        stamp(stay.check_in),
        stamp(stay.actual_check_out ?? stay.expected_check_out),
        t(RATE_KIND_KEYS[stay.rate_kind]),
        t(PAYMENT_STATUS_KEYS[stay.payment_status]),
        money(stay.total_amount),
      ])
    );
  }

  doc.spacer(6);
  doc.paragraph(t("reports.pdfGenerated", { when: `${utcToLocalInput(new Date()).replace("T", " ")} (${HOTEL_TZ})` }), 8);

  const bytes = doc.build();

  return new NextResponse(bytes, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="rapport_${range.from}_${range.to}.pdf"`,
      "Content-Length": String(bytes.length),
      "Cache-Control": "no-store", // guest personal data: never cache
    },
  });
}
