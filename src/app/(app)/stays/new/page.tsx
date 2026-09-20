import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { StayForm } from "@/components/stays/StayForm";
import { PageHeader } from "@/components/ui/PageHeader";
import { getSession } from "@/lib/auth";
import { utcToLocalInput } from "@/lib/datetime";
import { translator } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/server";
import type { RoomOption, RoomStatusRow } from "@/lib/types";
import { createStay } from "../actions";

export const metadata: Metadata = { title: "Nouveau check-in" };

/** Reception's main screen. The administrator is sent back to the overview. */
export default async function NewStayPage() {
  const { profile } = await getSession();
  if (profile?.role === "admin") redirect("/dashboard");

  const t = translator("fr"); // reception is always French
  const supabase = await createClient();

  // room_status already knows which rooms are occupied right now.
  const { data } = await supabase
    .from("room_status")
    .select("id, room_number, room_type, price_per_night, price_short_stay, state")
    .neq("state", "out_of_service");

  const rooms: RoomOption[] = (
    (data ?? []) as Pick<
      RoomStatusRow,
      "id" | "room_number" | "room_type" | "price_per_night" | "price_short_stay" | "state"
    >[]
  )
    .map((r) => ({
      id: r.id,
      room_number: r.room_number,
      room_type: r.room_type,
      price_per_night: r.price_per_night,
      price_short_stay: r.price_short_stay,
      occupied: r.state === "occupied",
    }))
    .sort((a, b) => a.room_number.localeCompare(b.room_number, undefined, { numeric: true }));

  // Defaults: check in now, check out tomorrow at noon (hotel local time). Staff can change both.
  const now = new Date();
  const checkIn = utcToLocalInput(now);
  const tomorrowNoon = `${utcToLocalInput(new Date(now.getTime() + 24 * 3_600_000)).slice(0, 10)}T12:00`;

  return (
    <>
      <PageHeader title={t("form.newTitle")} description={t("form.newDesc")} />
      <StayForm
        mode="create"
        rooms={rooms}
        action={createStay}
        cancelHref="/stays"
        lang="fr"
        defaults={{
          first_name: "",
          last_name: "",
          phone: "",
          email: "",
          id_number: "",
          address: "",
          room_id: "",
          rate_kind: "night",
          check_in: checkIn,
          expected_check_out: tomorrowNoon,
          price_per_night: "",
          payment_status: "unpaid",
          notes: "",
        }}
      />
    </>
  );
}
