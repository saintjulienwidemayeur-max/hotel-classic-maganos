"use server";

/**
 * Administrator settings: the two access codes, and the language of the
 * administration screens.
 *
 * Codes are stored as a salted hash in public.app_settings (see migration 6) and
 * never in clear text. Row Level Security only lets an administrator write there,
 * so the check below is a second gate, not the only one.
 */

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { COMMON_CODES, hashPin, isPinShaped } from "@/lib/access";
import { getSession } from "@/lib/auth";
import { PIN_LENGTH } from "@/lib/constants";
import { friendlyDbError } from "@/lib/db-errors";
import { isLang, type Lang } from "@/lib/i18n";
import { LANG_COOKIE, getT } from "@/lib/lang";
import { createClient } from "@/lib/supabase/server";
import type { FormState } from "@/lib/types";

type CodeRole = "admin" | "reception";

const SETTING_KEY: Record<CodeRole, string> = {
  admin: "admin_pin_hash",
  reception: "reception_pin_hash",
};

/** Change one of the two access codes. */
export async function setAccessCode(role: CodeRole, _prev: FormState, formData: FormData): Promise<FormState> {
  const { t } = await getT();

  const { profile } = await getSession();
  if (!profile || profile.role !== "admin") return { error: t("settings.adminOnly") };

  const pin = String(formData.get("pin") ?? "").trim();
  const confirm = String(formData.get("confirm") ?? "").trim();

  if (!isPinShaped(pin)) return { error: t("settings.codeDigits", { n: PIN_LENGTH }), fieldErrors: { pin: t("settings.codeDigits", { n: PIN_LENGTH }) } };
  if (pin !== confirm) return { error: t("settings.codeMismatch"), fieldErrors: { confirm: t("settings.codeMismatch") } };
  if (COMMON_CODES.has(pin)) return { error: t("settings.codeCommon"), fieldErrors: { pin: t("settings.codeCommon") } };

  const hash = hashPin(pin);
  const supabase = await createClient();

  // The two codes must stay different, including against a code stored earlier.
  const otherRole: CodeRole = role === "admin" ? "reception" : "admin";
  const { data: other } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", SETTING_KEY[otherRole])
    .maybeSingle();
  if (other?.value === hash) return { error: t("settings.codeSame"), fieldErrors: { pin: t("settings.codeSame") } };

  const { data, error } = await supabase
    .from("app_settings")
    .upsert(
      { key: SETTING_KEY[role], value: hash, updated_at: new Date().toISOString(), updated_by: profile.id },
      { onConflict: "key" }
    )
    .select("key");

  if (error) return { error: friendlyDbError(error, t) };
  if (!data || data.length === 0) return { error: t("settings.codeNotSaved") };

  revalidatePath("/settings");
  return { success: true };
}

/** Switch the administration screens between French and English. */
export async function setLanguage(lang: Lang) {
  const { profile } = await getSession();
  if (!profile || profile.role !== "admin" || !isLang(lang)) return;

  const store = await cookies();
  store.set(LANG_COOKIE, lang, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    secure: process.env.NODE_ENV === "production",
  });

  revalidatePath("/", "layout");
}
