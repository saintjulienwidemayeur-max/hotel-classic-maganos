import { cache } from "react";
import { cookies } from "next/headers";
import { getSession } from "./auth";
import { DEFAULT_LANG, isLang, translator, type Lang, type Translate } from "./i18n";

/** Cookie that remembers the administrator's choice of language. */
export const LANG_COOKIE = "lang";

/**
 * Which language this request is in.
 *
 *   Reception (and the sign-in screen): ALWAYS French.
 *   Administrator: French or English, from the "lang" cookie.
 *
 * Cached per request, like getSession(), so layout and page agree.
 */
export const getLang = cache(async (): Promise<Lang> => {
  const { profile } = await getSession();
  if (profile?.role !== "admin") return "fr";

  const value = (await cookies()).get(LANG_COOKIE)?.value;
  return isLang(value) ? value : DEFAULT_LANG;
});

/** Language + translate function for Server Components and Server Actions. */
export async function getT(): Promise<{ lang: Lang; t: Translate }> {
  const lang = await getLang();
  return { lang, t: translator(lang) };
}
