import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { StayForm } from "@/components/stays/StayForm";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { PageHeader } from "@/components/ui/PageHeader";
import { utcToLocalInput } from "@/lib/datetime";
import { fullName } from "@/lib/format";
import { translator } from "@/lib/i18n";
import { getLang } from "@/lib/lang";
import { createClient } from "@/lib/supabase/server";
import type { RoomOption, RoomStatusRow, StayDetail } from "@/lib/types";
import { uuidSchema } from "@/lib/validation";
import { updateStay } from "../../actions";

export const metadata: Metadata = { title: "Modifier le séjour" };

export default async function EditStayPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!uuidSchema.safeParse(id).success) notFound();

  const lang = await getLang();
  const t = translator(lang);
  const supabase = await createClient();

  const [{ data: stayData }, { data: roomData }] = await Promise.all([
    supabase.from("stay_details").select("*").eq("id", id).maybeSingle(),
    supabase.from("room_status").select("id, room_number, room_type, price_per_night, price_short_stay, state, stay_id"),
  ]);

  if (!stayData) notFound();
  const stay = stayData as StayDetail;

  // Offer every in-service room, plus this stay's own room even if it is out of service now.
  const rooms: RoomOption[] = ((roomData ?? []) as RoomStatusRow[])
    .filter((r) => r.state !== "out_of_service" || r.id === stay.room_id)
    .map((r) => ({
      id: r.id,
      room_number: r.room_number,
      room_type: r.room_type,
      price_per_night: r.price_per_night,
      price_short_stay: r.price_short_stay,
      // The stay's own room is not "occupied" from its own point of view.
      occupied: r.state === "occupied" && r.stay_id !== stay.id,
    }))
    .sort((a, b) => a.room_number.localeCompare(b.room_number, undefined, { numeric: true }));

  return (
    <>
      <PageHeader
        title={t("form.editTitle", { name: fullName(stay) })}
        description={t("form.editDesc")}
        actions={<StatusBadge status={stay.status} lang={lang} />}
      />
      <StayForm
        mode="edit"
        rooms={rooms}
        action={updateStay.bind(null, stay.id)}
        cancelHref="/stays"
        lang={lang}
        defaults={{
          first_name: stay.first_name,
          last_name: stay.last_name,
          phone: stay.phone,
          email: stay.email ?? "",
          id_number: stay.id_number,
          address: stay.address,
          room_id: stay.room_id,
          rate_kind: stay.rate_kind,
          check_in: utcToLocalInput(stay.check_in),
          expected_check_out: utcToLocalInput(stay.expected_check_out),
          price_per_night: String(stay.price_per_night),
          payment_status: stay.payment_status,
          notes: stay.notes ?? "",
          status: stay.status,
        }}
      />
    </>
  );
}
