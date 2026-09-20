import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { PAYMENT_STATUS_KEYS, RATE_KIND_KEYS, ROOM_TYPE_KEYS, STAY_STATUS_KEYS } from "@/lib/constants";
import { toCsv } from "@/lib/csv";
import { HOTEL_TZ, utcToLocalInput, zonedLocalToUtc } from "@/lib/datetime";
import { translator } from "@/lib/i18n";
import { getLang } from "@/lib/lang";
import { addDays, resolveRange } from "@/lib/report-range";
import { createClient } from "@/lib/supabase/server";
import type { StayDetail } from "@/lib/types";

/** Upper bound so an export can never grow without limit. */
const MAX_ROWS = 10_000;

/** "2026-09-14T15:30" -> "2026-09-14 15:30" in the hotel's time zone. Empty for missing values. */
const localStamp = (iso: string | null) => (iso ? utcToLocalInput(iso).replace("T", " ") : "");

/**
 * GET /reports/export?from=YYYY-MM-DD&to=YYYY-MM-DD
 * Downloads every stay that CHECKED IN during the period (any status) as a CSV file.
 * Administrators only: reception gets 403 even if they guess the address.
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

  // Period boundaries are midnight in the HOTEL's zone, expressed as UTC instants.
  const start = zonedLocalToUtc(`${range.from}T00:00`, HOTEL_TZ);
  const end = zonedLocalToUtc(`${addDays(range.to, 1)}T00:00`, HOTEL_TZ);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("stay_details")
    .select("*")
    .gte("check_in", start.toISOString())
    .lt("check_in", end.toISOString())
    .order("check_in", { ascending: true })
    .limit(MAX_ROWS);

  if (error) return new NextResponse("Could not build the export.", { status: 500 });

  const stays = (data ?? []) as StayDetail[];
  const csv = toCsv(
    [
      t("reports.colCheckIn"), t("form.checkOut"), t("stays.left"), t("stays.col.status"),
      t("stays.col.room"), t("form.roomType"), t("form.rateKind"),
      t("form.firstName"), t("form.lastName"), t("form.phone"), t("form.email"),
      t("form.idNumber"), t("form.address"),
      t("reports.colNights"), t("form.pricePerNight"), t("stays.col.total"), t("stays.col.payment"), t("form.notes"),
    ],
    stays.map((stay) => [
      localStamp(stay.check_in),
      localStamp(stay.expected_check_out),
      localStamp(stay.actual_check_out),
      t(STAY_STATUS_KEYS[stay.status]),
      stay.room_number,
      t(ROOM_TYPE_KEYS[stay.room_type]),
      t(RATE_KIND_KEYS[stay.rate_kind]),
      stay.first_name,
      stay.last_name,
      stay.phone,
      stay.email,
      stay.id_number,
      stay.address,
      stay.rate_kind === "short" ? "" : stay.nights,
      stay.price_per_night,
      stay.total_amount,
      t(PAYMENT_STATUS_KEYS[stay.payment_status]),
      stay.notes,
    ])
  );

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="sejours_${range.from}_${range.to}.csv"`,
      "Cache-Control": "no-store", // guest personal data: never cache
    },
  });
}
