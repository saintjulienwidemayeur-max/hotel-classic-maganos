import Link from "next/link";
import { translator, type Lang } from "@/lib/i18n";

/** Switch between the two administrator report pages (visible on every screen size). */
export function AdminTabs({ active, lang }: { active: "reports" | "guests"; lang: Lang }) {
  const t = translator(lang);
  const tab = (isActive: boolean) =>
    `rounded-md px-4 py-2 text-sm font-medium transition-colors ${
      isActive ? "bg-ink-900 text-white" : "text-ink-700 hover:bg-ink-100"
    }`;

  return (
    <nav aria-label={t("nav.adminPages")} className="mb-6 flex gap-1 border-b border-ink-100 pb-3">
      <Link href="/reports" aria-current={active === "reports" ? "page" : undefined} className={tab(active === "reports")}>
        {t("nav.reports")}
      </Link>
      <Link href="/guests" aria-current={active === "guests" ? "page" : undefined} className={tab(active === "guests")}>
        {t("nav.guests")}
      </Link>
    </nav>
  );
}
