import type { Metadata } from "next";
import { CompactStayList } from "@/components/stays/CompactStayList";
import { Metric } from "@/components/ui/Metric";
import { PageHeader } from "@/components/ui/PageHeader";
import { requireAdmin } from "@/lib/auth";
import { todayRangeUtc } from "@/lib/datetime";
import { formatLongDate } from "@/lib/format";
import { translator } from "@/lib/i18n";
import { getLang } from "@/lib/lang";
import { createClient } from "@/lib/supabase/server";
import type { DashboardStats, StayDetail } from "@/lib/types";

export const metadata: Metadata = { title: "Aperçu" };

/** The overview is the administrator's home screen. */
export default async function DashboardPage() {
  await requireAdmin();
  const lang = await getLang();
  const t = translator(lang);

  const supabase = await createClient();

  // "Today" is defined by the hotel's time zone, not the server's.
  const { start, end } = todayRangeUtc();

  // Three requests in parallel: headline numbers, today's departures, upcoming arrivals.
  const [statsResult, dueResult, arrivalsResult] = await Promise.all([
    supabase.rpc("dashboard_stats", { p_day_start: start.toISOString(), p_day_end: end.toISOString() }).single(),
    supabase
      .from("stay_details")
      .select("*")
      .eq("status", "active")
      .lt("expected_check_out", end.toISOString()) // due today OR overdue
      .order("expected_check_out", { ascending: true })
      .limit(15),
    supabase
      .from("stay_details")
      .select("*")
      .eq("status", "pending")
      .order("check_in", { ascending: true })
      .limit(8),
  ]);

  if (statsResult.error) throw new Error(statsResult.error.message);

  const stats = statsResult.data as DashboardStats;
  const dueOut = (dueResult.data ?? []) as StayDetail[];
  const arrivals = (arrivalsResult.data ?? []) as StayDetail[];

  return (
    <>
      <PageHeader title={t("dash.title")} description={formatLongDate(new Date(), lang)} />

      {/* One ledger strip instead of four separate cards */}
      <dl className="panel grid grid-cols-2 divide-x divide-y divide-ink-100 lg:grid-cols-4 lg:divide-y-0">
        <Metric label={t("dash.guestsInHouse")} value={stats.checked_in_guests} note={t("dash.guestsInHouseNote")} />
        <Metric
          label={t("dash.roomsAvailable")}
          value={stats.available_rooms}
          note={t("dash.roomsAvailableNote", { n: stats.total_rooms })}
        />
        <Metric
          label={t("dash.checkoutsToday")}
          value={stats.checkouts_today}
          note={stats.overdue_checkouts > 0 ? t("dash.overdueNote", { n: stats.overdue_checkouts }) : t("dash.noneOverdue")}
          alert={stats.overdue_checkouts > 0}
        />
        <Metric label={t("dash.staysRecorded")} value={stats.total_stays} note={t("dash.allTime")} />
      </dl>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <CompactStayList
          title={t("dash.dueOut")}
          description={t("dash.dueOutDesc")}
          stays={dueOut}
          emptyText={t("dash.dueOutEmpty")}
          kind="due"
          dayStart={start.toISOString()}
          lang={lang}
        />
        <CompactStayList
          title={t("dash.arrivals")}
          description={t("dash.arrivalsDesc")}
          stays={arrivals}
          emptyText={t("dash.arrivalsEmpty")}
          kind="arrival"
          dayStart={start.toISOString()}
          lang={lang}
        />
      </div>
    </>
  );
}
