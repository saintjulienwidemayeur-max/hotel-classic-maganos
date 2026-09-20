import { ROOM_TYPE_KEYS } from "@/lib/constants";
import { formatDateTime, formatMoney } from "@/lib/format";
import { translator, type Lang, type MessageKey } from "@/lib/i18n";
import type { RoomState, RoomStatusRow } from "@/lib/types";
import { KeyTag } from "@/components/ui/KeyTag";
import { RoomPrices } from "./RoomPrices";
import { RoomToggle } from "./RoomToggle";

/** Look of a room tile per state. Occupied rooms are dark so they stand out at a glance. */
const TILE: Record<RoomState, { box: string; title: string; sub: string; dot: string; labelKey: MessageKey }> = {
  available: {
    box: "border-ink-100 bg-white",
    title: "text-ink-950",
    sub: "text-ink-600",
    dot: "bg-emerald-500",
    labelKey: "rooms.available",
  },
  occupied: {
    box: "border-ink-900 bg-ink-900",
    title: "text-white",
    sub: "text-ink-200",
    dot: "bg-brass-300",
    labelKey: "rooms.occupied",
  },
  out_of_service: {
    box: "border-dashed border-ink-300 bg-ink-50",
    title: "text-ink-600",
    sub: "text-ink-500",
    dot: "bg-ink-400",
    labelKey: "rooms.outOfService",
  },
};

/** Every room as a tile: number, type, both rates, and who is in it. */
export function RoomBoard({ rooms, isAdmin, lang }: { rooms: RoomStatusRow[]; isAdmin: boolean; lang: Lang }) {
  const t = translator(lang);

  return (
    <ul className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
      {rooms.map((room) => {
        const tile = TILE[room.state];
        const onDark = room.state === "occupied";

        return (
          <li key={room.id} className={`rounded-md border p-4 ${tile.box}`}>
            <div className="flex items-start justify-between gap-2">
              <KeyTag number={room.room_number} size="lg" tone={room.state === "out_of_service" ? "muted" : "brass"} />
              <span className={`mt-1 inline-flex items-center gap-1.5 text-xs font-medium ${tile.sub}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${tile.dot}`} aria-hidden="true" />
                {t(tile.labelKey)}
              </span>
            </div>

            <p className={`mt-4 text-sm font-medium ${tile.title}`}>{t(ROOM_TYPE_KEYS[room.room_type])}</p>
            <p className={`text-xs ${tile.sub}`}>{t("rooms.perNight", { money: formatMoney(room.price_per_night, lang) })}</p>
            <p className={`text-xs ${tile.sub}`}>{t("rooms.shortStayPrice", { money: formatMoney(room.price_short_stay, lang) })}</p>

            {room.state === "occupied" && room.guest_name ? (
              <div className={`mt-3 border-t border-ink-700 pt-3 text-sm ${tile.title}`}>
                <p className="truncate font-medium">{room.guest_name}</p>
                {room.expected_check_out ? (
                  <p className={`text-xs ${tile.sub}`}>
                    {t("rooms.dueOut", { when: formatDateTime(room.expected_check_out, lang) })}
                  </p>
                ) : null}
              </div>
            ) : null}

            {isAdmin ? (
              <RoomPrices
                roomId={room.id}
                pricePerNight={room.price_per_night}
                priceShortStay={room.price_short_stay}
                lang={lang}
                onDark={onDark}
              />
            ) : null}

            {isAdmin && room.state !== "occupied" ? (
              <RoomToggle roomId={room.id} active={room.is_active} lang={lang} />
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
