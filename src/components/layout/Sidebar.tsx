import Link from "next/link";
import { IconPlus } from "@/components/icons";
import { ROLE_KEYS } from "@/lib/constants";
import { translator, type Lang } from "@/lib/i18n";
import type { Profile } from "@/lib/types";
import { Brand } from "./Brand";
import { LanguageSwitch } from "./LanguageSwitch";
import { SideNav } from "./NavLinks";
import { SignOutButton } from "./SignOutButton";

/** Fixed left navigation for large screens (hidden below `lg`). */
export function Sidebar({ profile, lang }: { profile: Profile; lang: Lang }) {
  const t = translator(lang);
  const isAdmin = profile.role === "admin";

  return (
    <aside className="fixed inset-y-0 left-0 z-20 hidden w-64 flex-col bg-ink-900 px-4 py-6 lg:flex">
      <div className="px-3">
        <Brand tone="light" />
      </div>

      {/* Reception's main action. The administrator does not register check-ins. */}
      {isAdmin ? null : (
        <Link href="/stays/new" className="btn-brass mt-8">
          <IconPlus />
          {t("nav.newCheckIn")}
        </Link>
      )}

      <div className={isAdmin ? "mt-8" : "mt-6"}>
        <SideNav isAdmin={isAdmin} lang={lang} />
      </div>

      <div className="mt-auto border-t border-ink-700 pt-4">
        <p className="px-3 text-sm font-medium text-white">{t(ROLE_KEYS[profile.role])}</p>
        <p className="px-3 text-xs text-ink-300">{isAdmin ? t("role.adminNote") : t("role.staffNote")}</p>

        {isAdmin ? (
          <div className="mt-3 px-3">
            <LanguageSwitch lang={lang} tone="light" />
          </div>
        ) : null}

        <SignOutButton
          lang={lang}
          className="mt-3 flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-ink-200 hover:bg-ink-800 hover:text-white"
        />
      </div>
    </aside>
  );
}
