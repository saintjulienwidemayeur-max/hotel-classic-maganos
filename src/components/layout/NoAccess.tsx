import { translator } from "@/lib/i18n";
import { SignOutButton } from "./SignOutButton";

/**
 * Shown when someone is signed in but has no active staff profile
 * (deactivated, or the account was created before the migrations ran).
 * Always French: whoever sees this has no role yet.
 */
export function NoAccess() {
  const t = translator("fr");

  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <div className="panel max-w-md p-8 text-center">
        <h1 className="font-serif text-2xl font-semibold">{t("login.noAccessTitle")}</h1>
        <p className="mt-2 text-sm text-ink-600">{t("login.noAccessBody")}</p>
        <SignOutButton className="btn-secondary mx-auto mt-6" labelKey="login.backToCode" lang="fr" />
      </div>
    </main>
  );
}
