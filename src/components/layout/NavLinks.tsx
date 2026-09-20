"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentType, SVGProps } from "react";
import { IconBed, IconChart, IconList, IconOverview, IconPlus, IconSettings, IconUsers } from "@/components/icons";
import { translator, type Lang, type MessageKey } from "@/lib/i18n";

interface NavItem {
  href: string;
  labelKey: MessageKey;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  /** Path prefix that should NOT count as active for this item (e.g. /stays/new belongs to "New check-in"). */
  exclude?: string;
}

const OVERVIEW: NavItem = { href: "/dashboard", labelKey: "nav.overview", icon: IconOverview };
const STAYS: NavItem = { href: "/stays", labelKey: "nav.stays", icon: IconList, exclude: "/stays/new" };
const ROOMS: NavItem = { href: "/rooms", labelKey: "nav.rooms", icon: IconBed };
const NEW_ITEM: NavItem = { href: "/stays/new", labelKey: "nav.newCheckIn", icon: IconPlus };
const REPORTS: NavItem = { href: "/reports", labelKey: "nav.reports", icon: IconChart };
const GUESTS: NavItem = { href: "/guests", labelKey: "nav.guests", icon: IconUsers };
const SETTINGS: NavItem = { href: "/settings", labelKey: "nav.settings", icon: IconSettings };

/**
 * Who sees what:
 *   administrator -> overview, stays, rooms, reports, guests, settings (NO check-in screen)
 *   reception     -> the check-in form and the list of stays (to check guests out)
 */
const adminItems = [OVERVIEW, STAYS, ROOMS, REPORTS, GUESTS, SETTINGS];
const receptionItems = [NEW_ITEM, STAYS];

function isActive(pathname: string, item: NavItem) {
  const inside = pathname === item.href || pathname.startsWith(`${item.href}/`);
  const excluded = item.exclude ? pathname.startsWith(item.exclude) : false;
  return inside && !excluded;
}

/** Desktop sidebar navigation. */
export function SideNav({ isAdmin, lang }: { isAdmin: boolean; lang: Lang }) {
  const pathname = usePathname();
  const t = translator(lang);
  const items = isAdmin ? adminItems : receptionItems;

  return (
    <nav aria-label={t("nav.main")} className="flex flex-col gap-1">
      {items.map((item) => {
        const active = isActive(pathname, item);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`flex items-center gap-3 rounded-md border-l-2 px-3 py-2.5 text-sm font-medium transition-colors ${
              active
                ? "border-brass-400 bg-ink-800 text-white"
                : "border-transparent text-ink-200 hover:bg-ink-800/60 hover:text-white"
            }`}
          >
            <item.icon />
            {t(item.labelKey)}
          </Link>
        );
      })}
    </nav>
  );
}

/** Mobile bottom tab bar: thumb-reachable. Guests live under the Reports tab on phones. */
export function BottomNav({ isAdmin, lang }: { isAdmin: boolean; lang: Lang }) {
  const pathname = usePathname();
  const t = translator(lang);
  const items = isAdmin ? [OVERVIEW, STAYS, ROOMS, REPORTS, SETTINGS] : [NEW_ITEM, STAYS];

  return (
    <nav
      aria-label={t("nav.main")}
      className="fixed inset-x-0 bottom-0 z-30 border-t border-ink-200 bg-white pb-[env(safe-area-inset-bottom)] lg:hidden"
    >
      <ul className={`mx-auto grid max-w-md ${isAdmin ? "grid-cols-5" : "grid-cols-2"}`}>
        {items.map((item) => {
          const active = isActive(pathname, item) || (item === REPORTS && pathname.startsWith("/guests"));
          const isNew = item === NEW_ITEM;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`flex h-16 flex-col items-center justify-center gap-1 text-xs font-medium ${
                  active ? "text-lagoon-700" : "text-ink-500"
                }`}
              >
                <span
                  className={
                    isNew
                      ? "flex h-8 w-8 items-center justify-center rounded-full bg-brass-300 text-ink-950"
                      : active
                        ? "flex h-8 w-8 items-center justify-center rounded-full bg-lagoon-50"
                        : "flex h-8 w-8 items-center justify-center"
                  }
                >
                  <item.icon width={20} height={20} />
                </span>
                {t(item.labelKey)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
