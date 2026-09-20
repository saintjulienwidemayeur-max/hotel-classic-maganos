import Link from "next/link";
import { IconChevronLeft, IconChevronRight } from "@/components/icons";
import { translator, type Lang } from "@/lib/i18n";

/** Previous / next links that keep the current search and filter in the URL. */
export function Pagination({
  page,
  totalPages,
  totalItems,
  params,
  basePath = "/stays",
  noun,
  lang = "fr",
}: {
  page: number;
  totalPages: number;
  totalItems: number;
  params: Record<string, string | undefined>;
  /** Page the links point to (defaults to the Stays list). */
  basePath?: string;
  /** Already-translated word used in "Page 1 / 3 (42 séjours)". */
  noun?: string;
  lang?: Lang;
}) {
  if (totalPages <= 1) return null;
  const t = translator(lang);

  const hrefFor = (target: number) => {
    const next = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) if (value) next.set(key, value);
    if (target > 1) next.set("page", String(target));
    const qs = next.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  };

  return (
    <nav aria-label={t("page.nav")} className="mt-4 flex items-center justify-between text-sm">
      <p className="text-ink-600">
        {t("page.line", {
          a: page,
          b: totalPages,
          n: totalItems,
          noun: (noun ?? t("nav.stays")).toLowerCase(),
        })}
      </p>
      <div className="flex gap-2">
        {page > 1 ? (
          <Link href={hrefFor(page - 1)} className="btn-secondary btn-sm">
            <IconChevronLeft width={14} height={14} />
            {t("page.prev")}
          </Link>
        ) : null}
        {page < totalPages ? (
          <Link href={hrefFor(page + 1)} className="btn-secondary btn-sm">
            {t("page.next")}
            <IconChevronRight width={14} height={14} />
          </Link>
        ) : null}
      </div>
    </nav>
  );
}
