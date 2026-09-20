import { ROLE_KEYS } from "@/lib/constants";
import { translator, type Lang } from "@/lib/i18n";
import type { Profile } from "@/lib/types";
import { Brand } from "./Brand";
import { LanguageSwitch } from "./LanguageSwitch";
import { SignOutButton } from "./SignOutButton";

/** Slim top bar for phones and tablets (hidden from `lg` up, where the sidebar takes over). */
export function MobileHeader({ profile, lang }: { profile: Profile; lang: Lang }) {
  const t = translator(lang);

  return (
    <header className="sticky top-0 z-20 flex items-center justify-between border-b border-ink-100 bg-white px-4 py-3 lg:hidden">
      <Brand />
      <div className="flex items-center gap-2">
        {profile.role === "admin" ? <LanguageSwitch lang={lang} /> : null}
        <span className="hidden text-xs font-medium text-ink-600 min-[380px]:inline">{t(ROLE_KEYS[profile.role])}</span>
        <SignOutButton lang={lang} className="btn-secondary btn-sm" />
      </div>
    </header>
  );
}
