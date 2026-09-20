import type { Metadata } from "next";
import { AddRoomForm } from "@/components/rooms/AddRoomForm";
import { RoomBoard } from "@/components/rooms/RoomBoard";
import { PageHeader } from "@/components/ui/PageHeader";
import { requireAdmin } from "@/lib/auth";
import { translator } from "@/lib/i18n";
import { getLang } from "@/lib/lang";
import { createClient } from "@/lib/supabase/server";
import type { RoomStatusRow } from "@/lib/types";

export const metadata: Metadata = { title: "Chambres" };

/** Rooms and rates are set by the administrator (reception does not need this screen). */
export default async function RoomsPage() {
  await requireAdmin();
  const lang = await getLang();
  const t = translator(lang);

  const supabase = await createClient();
  const { data, error } = await supabase.from("room_status").select("*");
  if (error) throw new Error(error.message);

  // "2" before "10": natural number order.
  const rooms = ((data ?? []) as RoomStatusRow[]).sort((a, b) =>
    a.room_number.localeCompare(b.room_number, undefined, { numeric: true })
  );

  const count = (state: RoomStatusRow["state"]) => rooms.filter((r) => r.state === state).length;

  return (
    <>
      <PageHeader
        title={t("rooms.title")}
        description={t("rooms.desc", { a: count("available"), b: count("occupied"), c: count("out_of_service") })}
      />

      <AddRoomForm lang={lang} />

      {rooms.length === 0 ? (
        <div className="panel px-6 py-12 text-center text-sm text-ink-600">{t("rooms.empty")}</div>
      ) : (
        <RoomBoard rooms={rooms} isAdmin lang={lang} />
      )}
    </>
  );
}
