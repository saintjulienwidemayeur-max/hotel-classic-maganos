import type { Metadata } from "next";
import Link from "next/link";
import { IconSearch } from "@/components/icons";
import { AdminTabs } from "@/components/reports/AdminTabs";
import { PageHeader } from "@/components/ui/PageHeader";
import { Pagination } from "@/components/ui/Pagination";
import { requireAdmin } from "@/lib/auth";
import { PAGE_SIZE } from "@/lib/constants";
import { formatDate, formatMoney } from "@/lib/format";
import { translator } from "@/lib/i18n";
import { getLang } from "@/lib/lang";
import { toSearchTokens } from "@/lib/search";
import { createClient } from "@/lib/supabase/server";
import type { GuestSummary } from "@/lib/types";

export const metadata: Metadata = { title: "Clients" };

type SearchParams = Promise<{ q?: string; page?: string }>;

/** The administrator's guest directory: search by name, phone, ID or email. */
export default async function GuestsPage({ searchParams }: { searchParams: SearchParams }) {
  await requireAdmin();
  const sp = await searchParams;
  const lang = await getLang();
  const t = translator(lang);

  const q = (sp.q ?? "").trim().slice(0, 80);
  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);
  const from = (page - 1) * PAGE_SIZE;

  const supabase = await createClient();
  let query = supabase
    .from("guest_summary")
    .select("id, first_name, last_name, phone, email, id_number, address, stay_count, total_billed, last_check_in", { count: "exact" });

  for (const token of toSearchTokens(q)) query = query.ilike("search_text", `%${token}%`);

  const { data, error, count } = await query
    .order("last_check_in", { ascending: false, nullsFirst: false })
    .order("last_name", { ascending: true })
    .range(from, from + PAGE_SIZE - 1);

  // A page past the end (for example after a search narrowed the results) is not an error.
  if (error && error.code !== "PGRST103") throw new Error(error.message);

  const guests = (data ?? []) as GuestSummary[];
  const total = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <>
      <PageHeader title={t("guests.title")} description={t("guests.desc")} />
      <AdminTabs active="guests" lang={lang} />

      {/* Plain GET form: works without JavaScript and keeps the search in the URL */}
      <form method="get" action="/guests" className="mb-4 flex gap-2">
        <div className="relative flex-1">
          <IconSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
          <input
            name="q"
            type="search"
            defaultValue={q}
            placeholder={t("guests.searchPlaceholder")}
            aria-label={t("guests.searchLabel")}
            className="input pl-10"
          />
        </div>
        <button type="submit" className="btn-primary">
          {t("common.search")}
        </button>
      </form>

      {guests.length === 0 ? (
        <div className="panel px-6 py-12 text-center text-sm text-ink-600">
          {q ? t("guests.noMatch", { q }) : t("guests.empty")}
        </div>
      ) : (
        <ul className="panel divide-y divide-ink-100">
          {guests.map((guest) => (
            <li key={guest.id} className="grid gap-x-6 gap-y-1 px-5 py-4 sm:grid-cols-[1.4fr_1fr_auto] sm:items-center">
              <div className="min-w-0">
                <p className="truncate font-medium text-ink-950">
                  {guest.first_name} {guest.last_name}
                </p>
                <p className="truncate text-sm text-ink-600">
                  {guest.phone}
                  {guest.email ? `, ${guest.email}` : ""}
                </p>
                <p className="truncate text-xs text-ink-500">
                  {t("stays.idShort")} {guest.id_number}, {guest.address}
                </p>
              </div>
              <div className="text-sm">
                <p className="tabular-nums text-ink-950">
                  {t("guests.stayCount", { n: guest.stay_count, money: formatMoney(guest.total_billed, lang) })}
                </p>
                <p className="text-xs text-ink-500">
                  {guest.last_check_in
                    ? t("guests.lastVisit", { when: formatDate(guest.last_check_in, lang) })
                    : t("guests.noVisits")}
                </p>
              </div>
              <Link
                href={`/stays?q=${encodeURIComponent(guest.id_number)}`}
                className="btn-secondary btn-sm justify-self-start sm:justify-self-end"
              >
                {t("guests.viewStays")}
              </Link>
            </li>
          ))}
        </ul>
      )}

      <Pagination
        page={page}
        totalPages={totalPages}
        totalItems={total}
        params={{ q: q || undefined }}
        basePath="/guests"
        noun={t("nav.guests")}
        lang={lang}
      />
    </>
  );
}
