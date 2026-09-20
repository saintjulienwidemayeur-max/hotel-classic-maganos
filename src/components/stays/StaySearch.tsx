"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { IconSearch, IconSpinner, IconX } from "@/components/icons";
import { STAY_STATUS_KEYS } from "@/lib/constants";
import { translator, type Lang, type MessageKey } from "@/lib/i18n";

const TABS: { value: string; key: MessageKey }[] = [
  { value: "all", key: "stays.tabAll" },
  { value: "active", key: STAY_STATUS_KEYS.active },
  { value: "pending", key: STAY_STATUS_KEYS.pending },
  { value: "checked_out", key: STAY_STATUS_KEYS.checked_out },
  { value: "cancelled", key: STAY_STATUS_KEYS.cancelled },
];

/**
 * Search box + status tabs.
 *
 * Both write to the URL (?q=...&status=...), which the server page reads. That keeps
 * results shareable/bookmarkable and means the browser only downloads the rows that match.
 * Typing is debounced (250 ms) so results update as you type without a request per keystroke.
 */
export function StaySearch({ initialQuery, status, lang = "fr" }: { initialQuery: string; status: string; lang?: Lang }) {
  const t = translator(lang);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [value, setValue] = useState(initialQuery);
  const [isPending, startTransition] = useTransition();
  const mounted = useRef(false);

  useEffect(() => {
    // Skip the first run: the URL already reflects the initial query.
    if (!mounted.current) {
      mounted.current = true;
      return;
    }

    const timer = setTimeout(() => {
      const next = new URLSearchParams(searchParams.toString());
      const query = value.trim();
      if (query) next.set("q", query);
      else next.delete("q");
      next.delete("page"); // a new search always starts on page 1

      if (next.toString() === searchParams.toString()) return;
      startTransition(() => router.replace(`${pathname}?${next.toString()}`, { scroll: false }));
    }, 250);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  function tabHref(tab: string) {
    const next = new URLSearchParams(searchParams.toString());
    if (tab === "all") next.delete("status");
    else next.set("status", tab);
    next.delete("page");
    const qs = next.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  }

  return (
    <div className="space-y-3">
      <div className="relative">
        <IconSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
        <input
          type="search"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder={t("stays.searchPlaceholder")}
          aria-label={t("stays.searchLabel")}
          autoComplete="off"
          enterKeyHint="search"
          className="input pl-10 pr-10"
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-400">
          {isPending ? (
            <IconSpinner />
          ) : value ? (
            <button type="button" onClick={() => setValue("")} aria-label={t("stays.clearSearch")} className="hover:text-ink-700">
              <IconX />
            </button>
          ) : null}
        </div>
      </div>

      <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <div role="tablist" aria-label={t("stays.filterByStatus")} className="inline-flex gap-1 rounded-md bg-ink-100 p-1">
          {TABS.map((tab) => {
            const selected = tab.value === status;
            return (
              <Link
                key={tab.value}
                href={tabHref(tab.value)}
                role="tab"
                aria-selected={selected}
                scroll={false}
                className={`whitespace-nowrap rounded px-3.5 py-1.5 text-sm font-medium transition-colors ${
                  selected ? "bg-white text-ink-950 shadow-sm" : "text-ink-600 hover:text-ink-950"
                }`}
              >
                {t(tab.key)}
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
