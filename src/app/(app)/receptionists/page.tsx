import type { Metadata } from "next";
import { AddReceptionistForm } from "@/components/receptionists/AddReceptionistForm";
import { ReceptionistRow } from "@/components/receptionists/ReceptionistRow";
import { PageHeader } from "@/components/ui/PageHeader";
import { requireAdmin } from "@/lib/auth";
import { translator } from "@/lib/i18n";
import { getLang } from "@/lib/lang";
import { createClient } from "@/lib/supabase/server";
import type { Receptionist } from "@/lib/types";

export const metadata: Metadata = { title: "Réceptionnistes" };

/** Administrator: who may sign in at the front desk, each with a personal code. */
export default async function ReceptionistsPage() {
  await requireAdmin();
  const lang = await getLang();
  const t = translator(lang);

  const supabase = await createClient();
  const [{ data, error }, { data: stays }] = await Promise.all([
    supabase.from("receptionists").select("id, full_name, is_active, created_at").order("full_name"),
    supabase.from("stays").select("recorded_by_name").limit(20000),
  ]);
  if (error) throw new Error(error.message);

  const counts = new Map<string, number>();
  for (const row of stays ?? []) {
    const name = (row as { recorded_by_name: string | null }).recorded_by_name;
    if (name) counts.set(name, (counts.get(name) ?? 0) + 1);
  }

  const people = (data ?? []) as Receptionist[];

  return (
    <>
      <PageHeader title={t("recep.title")} description={t("recep.desc")} />

      <AddReceptionistForm lang={lang} />

      {people.length === 0 ? (
        <div className="panel px-6 py-12 text-center text-sm text-ink-600">{t("recep.empty")}</div>
      ) : (
        <ul className="panel divide-y divide-ink-100">
          {people.map((person) => (
            <ReceptionistRow key={person.id} receptionist={person} checkIns={counts.get(person.full_name) ?? 0} lang={lang} />
          ))}
        </ul>
      )}

      {people.some((p) => p.is_active) ? <p className="mt-4 max-w-prose text-xs text-ink-500">{t("recep.sharedOff")}</p> : null}
    </>
  );
}
