import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { IconPlus } from "@/components/icons";
import { StaySearch } from "@/components/stays/StaySearch";
import { StaysTable } from "@/components/stays/StaysTable";
import { Notice } from "@/components/ui/Notice";
import { PageHeader } from "@/components/ui/PageHeader";
import { Pagination } from "@/components/ui/Pagination";
import { getSession } from "@/lib/auth";
import { PAGE_SIZE, STAY_STATUSES } from "@/lib/constants";
import { translator } from "@/lib/i18n";
import { getLang } from "@/lib/lang";
import { toSearchTokens } from "@/lib/search";
import { createClient } from "@/lib/supabase/server";
import type { StayDetail } from "@/lib/types";

export const metadata: Metadata = { title: "Séjours" };

type SearchParams = Promise<{ q?: string; status?: string; page?: string; notice?: string }>;

/**
 * The list of stays. Reception uses it to check guests out; the administrator
 * uses it to look things up (and never registers a check-in from here).
 */
export default async function StaysPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const { profile } = await getSession();
  const isAdmin = profile?.role === "admin";
  const lang = await getLang();
  const t = translator(lang);

  const q = (sp.q ?? "").trim().slice(0, 80);
  const status = (STAY_STATUSES as string[]).includes(sp.status ?? "") ? (sp.status as string) : "all";
  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);
  const from = (page - 1) * PAGE_SIZE;

  const supabase = await createClient();

  // Every search word must appear somewhere in name / phone / ID / email / room number.
  let query = supabase.from("stay_details").select("*", { count: "exact" });
  if (status !== "all") query = query.eq("status", status);
  for (const token of toSearchTokens(q)) query = query.ilike("search_text", `%${token}%`);

  // Upcoming arrivals read best soonest-first; everything else newest-first.
  query = query.order("check_in", { ascending: status === "pending" }).range(from, from + PAGE_SIZE - 1);

  const { data, count, error } = await query;
  if (error) {
    // PGRST103 = "page past the end" (e.g. a stale ?page=9 bookmark): send them back to page 1.
    if (error.code === "PGRST103") {
      const back = new URLSearchParams();
      if (q) back.set("q", q);
      if (status !== "all") back.set("status", status);
      redirect(back.size > 0 ? `/stays?${back.toString()}` : "/stays");
    }
    throw new Error(error.message);
  }

  const stays = (data ?? []) as StayDetail[];
  const total = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <>
      <PageHeader
        title={t("stays.title")}
        description={t("stays.desc")}
        actions={
          isAdmin ? null : (
            <Link href="/stays/new" className="btn-primary">
              <IconPlus />
              {t("nav.newCheckIn")}
            </Link>
          )
        }
      />

      <Notice code={sp.notice} lang={lang} />

      <Suspense fallback={null}>
        <StaySearch initialQuery={q} status={status} lang={lang} />
      </Suspense>

      <div className="mt-5">
        {stays.length === 0 ? (
          <div className="panel px-6 py-12 text-center">
            {q || status !== "all" ? (
              <>
                <p className="font-medium text-ink-900">{q ? t("stays.noMatchQuery", { q }) : t("stays.noMatchFilter")}</p>
                <p className="mt-1 text-sm text-ink-600">{t("stays.searchHint")}</p>
              </>
            ) : (
              <>
                <p className="font-medium text-ink-900">{t("stays.empty")}</p>
                {isAdmin ? null : (
                  <Link href="/stays/new" className="btn-primary mt-4">
                    {t("stays.registerFirst")}
                  </Link>
                )}
              </>
            )}
          </div>
        ) : (
          <>
            <p className="mb-3 text-sm text-ink-600" aria-live="polite">
              {t("stays.found", { n: total })}
            </p>
            <StaysTable stays={stays} lang={lang} canCheckIn={!isAdmin} />
            <Pagination
              page={page}
              totalPages={totalPages}
              totalItems={total}
              params={{ q: q || undefined, status: status === "all" ? undefined : status }}
              noun={t("nav.stays")}
              lang={lang}
            />
          </>
        )}
      </div>
    </>
  );
}
