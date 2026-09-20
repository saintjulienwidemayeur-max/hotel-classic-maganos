import type { Metadata } from "next";
import { LanguageSwitch } from "@/components/layout/LanguageSwitch";
import { PinForm } from "@/components/settings/PinForm";
import { PageHeader } from "@/components/ui/PageHeader";
import { requireAdmin } from "@/lib/auth";
import { translator } from "@/lib/i18n";
import { getLang } from "@/lib/lang";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Réglages" };

/** Administrator settings: the two access codes, and the language of these screens. */
export default async function SettingsPage() {
  await requireAdmin();
  const lang = await getLang();
  const t = translator(lang);

  // Which codes have already been changed inside the app (only the key is read, never a code).
  const supabase = await createClient();
  const { data } = await supabase
    .from("app_settings")
    .select("key")
    .in("key", ["admin_pin_hash", "reception_pin_hash"]);

  const keys = new Set((data ?? []).map((row) => row.key as string));

  return (
    <>
      <PageHeader title={t("settings.title")} description={t("settings.desc")} />

      <section className="mb-6">
        <h2 className="font-serif text-xl font-semibold">{t("settings.codes")}</h2>
        <p className="mt-1 max-w-prose text-sm text-ink-600">{t("settings.codesDesc")}</p>
      </section>

      <div className="grid gap-4 xl:grid-cols-2">
        <PinForm role="admin" title={t("settings.adminCode")} isCustom={keys.has("admin_pin_hash")} lang={lang} />
        <PinForm role="reception" title={t("settings.receptionCode")} isCustom={keys.has("reception_pin_hash")} lang={lang} />
      </div>

      <section className="panel mt-6 p-5">
        <h2 className="font-serif text-lg font-semibold">{t("common.language")}</h2>
        <p className="mb-4 mt-1 max-w-prose text-sm text-ink-600">{t("settings.languageDesc")}</p>
        <LanguageSwitch lang={lang} />
      </section>
    </>
  );
}
