"use client";

import { useState, useTransition } from "react";
import { setRoomActive } from "@/app/(app)/rooms/actions";
import { translator, type Lang } from "@/lib/i18n";

/** Admin-only: take a room out of service, or put it back. */
export function RoomToggle({
  roomId,
  active,
  onDark = false,
  lang = "fr",
}: {
  roomId: string;
  active: boolean;
  onDark?: boolean;
  lang?: Lang;
}) {
  const t = translator(lang);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="mt-3">
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            const result = await setRoomActive(roomId, !active);
            if (result?.error) setError(result.error);
          });
        }}
        className={`text-xs font-medium underline underline-offset-2 disabled:opacity-60 ${
          onDark ? "text-ink-200 hover:text-white" : "text-ink-600 hover:text-ink-950"
        }`}
      >
        {active ? t("rooms.takeOut") : t("rooms.putBack")}
      </button>
      {error ? (
        <p role="alert" className={`mt-1 text-xs font-medium ${onDark ? "text-rose-300" : "text-rose-700"}`}>
          {error}
        </p>
      ) : null}
    </div>
  );
}
