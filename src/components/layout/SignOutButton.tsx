import { signOut } from "@/app/login/actions";
import { IconLock } from "@/components/icons";
import { translator, type Lang, type MessageKey } from "@/lib/i18n";

/**
 * "Lock": ends the session and returns to the code screen.
 * A plain <form> posting to a Server Action, so it works even before JavaScript loads.
 */
export function SignOutButton({
  className = "",
  labelKey = "common.lock",
  lang = "fr",
}: {
  className?: string;
  labelKey?: MessageKey;
  lang?: Lang;
}) {
  const t = translator(lang);
  return (
    <form action={signOut}>
      <button type="submit" className={className}>
        <IconLock />
        {t(labelKey)}
      </button>
    </form>
  );
}
