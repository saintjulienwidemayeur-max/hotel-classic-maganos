"use client";

import { useState, useTransition } from "react";
import { deleteRoom, setRoomActive } from "@/app/(app)/rooms/actions";
import { translator, type Lang } from "@/lib/i18n";

/** Admin-only: take a room out of service, or put it back. */
export function RoomToggle({
  roomId,
  roomNumber,
  active,
  onDark = false,
  lang = "fr",
}: {
  roomId: string;
  roomNumber: string;
  active: boolean;
  onDark?: boolean;
  lang?: Lang;
}) {
  const t = translator(lang);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const link = `text-xs font-medium underline underline-offset-2 disabled:opacity-60 ${
    onDark ? "text-ink-200 hover:text-white" : "text-ink-600 hover:text-ink-950"
  }`;

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
        className={link}
      >
        {active ? t("rooms.takeOut") : t("rooms.putBack")}
      </button>

      {confirming ? (
        <div className="mt-2 rounded-md border border-rose-200 bg-rose-50 p-2 text-xs text-rose-800">
          <p>{t("rooms.deleteConfirm", { n: roomNumber })}</p>
          <div className="mt-2 flex gap-3">
            <button
              type="button"
              disabled={pending}
              className="font-semibold underline underline-offset-2 disabled:opacity-60"
              onClick={() => {
                setError(null);
                startTransition(async () => {
                  const result = await deleteRoom(roomId);
                  if (result?.error) setError(result.error);
                  setConfirming(false);
                });
              }}
            >
              {t("rooms.deleteYes")}
            </button>
            <button type="button" className="underline underline-offset-2" onClick={() => setConfirming(false)}>
              {t("rooms.deleteNo")}
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            setError(null);
            setConfirming(true);
          }}
          className={`ml-3 ${link}`}
        >
          {t("rooms.delete")}
        </button>
      )}
      {error ? (
        <p role="alert" className={`mt-1 text-xs font-medium ${onDark ? "text-rose-300" : "text-rose-700"}`}>
          {error}
        </p>
      ) : null}
    </div>
  );
}
