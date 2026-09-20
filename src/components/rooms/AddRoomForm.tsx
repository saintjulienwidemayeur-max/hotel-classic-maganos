"use client";

import { startTransition, useActionState, useEffect, useRef } from "react";
import { createRoom } from "@/app/(app)/rooms/actions";
import { Field } from "@/components/ui/Field";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { ROOM_TYPES, ROOM_TYPE_KEYS } from "@/lib/constants";
import { translator, type Lang } from "@/lib/i18n";

/** Admin-only: add a room, with both of its rates. */
export function AddRoomForm({ lang }: { lang: Lang }) {
  const [state, formAction, pending] = useActionState(createRoom, undefined);
  const formRef = useRef<HTMLFormElement>(null);
  const errors = state?.fieldErrors ?? {};
  const t = translator(lang);

  // Clear the inputs after a successful add so the next room can be typed straight away.
  useEffect(() => {
    if (state?.success) formRef.current?.reset();
  }, [state]);

  const cls = (name: string) => (errors[name] ? "input input-invalid" : "input");

  return (
    <form
      ref={formRef}
      noValidate
      className="panel mb-6 p-5"
      onSubmit={(event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        startTransition(() => formAction(formData));
      }}
    >
      <h2 className="mb-4 font-serif text-lg font-semibold">{t("rooms.add")}</h2>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_1fr_auto] lg:items-start">
        <Field label={t("rooms.number")} htmlFor="new_room_number" error={errors.room_number}>
          <input id="new_room_number" name="room_number" autoComplete="off" placeholder="206" className={cls("room_number")} />
        </Field>
        <Field label={t("rooms.type")} htmlFor="new_room_type" error={errors.room_type}>
          <select id="new_room_type" name="room_type" defaultValue="double" className="input">
            {ROOM_TYPES.map((type) => (
              <option key={type} value={type}>
                {t(ROOM_TYPE_KEYS[type])}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t("rooms.ratePerNight")} htmlFor="new_room_price" error={errors.price_per_night}>
          <input id="new_room_price" name="price_per_night" type="number" inputMode="decimal" min="0" step="0.01" className={cls("price_per_night")} />
        </Field>
        <Field label={t("rooms.rateShort")} htmlFor="new_room_short" error={errors.price_short_stay}>
          <input id="new_room_short" name="price_short_stay" type="number" inputMode="decimal" min="0" step="0.01" defaultValue="0" className={cls("price_short_stay")} />
        </Field>
        <div className="lg:pt-[1.7rem]">
          <SubmitButton pending={pending} pendingLabel={t("rooms.adding")} className="btn-primary w-full">
            {t("rooms.add")}
          </SubmitButton>
        </div>
      </div>

      {state?.error ? (
        <p role="alert" className="mt-3 text-sm font-medium text-rose-700">
          {state.error}
        </p>
      ) : null}
      {state?.success ? (
        <p role="status" className="mt-3 text-sm font-medium text-emerald-800">
          {t("rooms.added")}
        </p>
      ) : null}
    </form>
  );
}
