"use client";

import { startTransition, useActionState, useState } from "react";
import { updateRoomPrices } from "@/app/(app)/rooms/actions";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { translator, type Lang } from "@/lib/i18n";

/**
 * Admin-only: change one room's nightly rate and its short-stay rate.
 * Hidden behind a link so the room board stays readable.
 */
export function RoomPrices({
  roomId,
  pricePerNight,
  priceShortStay,
  lang,
  onDark = false,
}: {
  roomId: string;
  pricePerNight: number;
  priceShortStay: number;
  lang: Lang;
  onDark?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(updateRoomPrices.bind(null, roomId), undefined);
  const t = translator(lang);
  const errors = state?.fieldErrors ?? {};

  const linkClass = `text-xs font-medium underline underline-offset-2 ${
    onDark ? "text-ink-200 hover:text-white" : "text-ink-600 hover:text-ink-950"
  }`;

  if (!open) {
    return (
      <div className="mt-3">
        <button type="button" className={linkClass} onClick={() => setOpen(true)}>
          {t("rooms.editPrices")}
        </button>
        {state?.success ? (
          <p role="status" className={`mt-1 text-xs font-medium ${onDark ? "text-emerald-300" : "text-emerald-800"}`}>
            {t("rooms.pricesSaved")}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <form
      noValidate
      className="mt-3 space-y-2 border-t border-ink-100 pt-3"
      onSubmit={(event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        startTransition(() => formAction(formData));
      }}
    >
      <label className="block text-xs font-medium text-ink-600" htmlFor={`night-${roomId}`}>
        {t("rooms.ratePerNight")}
      </label>
      <input
        id={`night-${roomId}`}
        name="price_per_night"
        type="number"
        inputMode="decimal"
        min="0"
        step="0.01"
        defaultValue={String(pricePerNight)}
        className={errors.price_per_night ? "input input-invalid" : "input"}
      />

      <label className="block text-xs font-medium text-ink-600" htmlFor={`short-${roomId}`}>
        {t("rooms.rateShort")}
      </label>
      <input
        id={`short-${roomId}`}
        name="price_short_stay"
        type="number"
        inputMode="decimal"
        min="0"
        step="0.01"
        defaultValue={String(priceShortStay)}
        className={errors.price_short_stay ? "input input-invalid" : "input"}
      />

      {state?.error ? (
        <p role="alert" className="text-xs font-medium text-rose-700">
          {state.error}
        </p>
      ) : null}

      <div className="flex items-center gap-2 pt-1">
        <SubmitButton pending={pending} pendingLabel={t("common.saving")} className="btn-primary btn-sm">
          {t("common.save")}
        </SubmitButton>
        <button type="button" className={linkClass} onClick={() => setOpen(false)}>
          {t("rooms.closePrices")}
        </button>
      </div>
    </form>
  );
}
