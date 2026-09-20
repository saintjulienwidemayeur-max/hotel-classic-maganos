"use client";

import Link from "next/link";
import { startTransition, useActionState, useState } from "react";
import { Field } from "@/components/ui/Field";
import { SubmitButton } from "@/components/ui/SubmitButton";
import {
  PAYMENT_STATUSES,
  PAYMENT_STATUS_KEYS,
  RATE_KINDS,
  RATE_KIND_KEYS,
  ROOM_TYPE_KEYS,
  STAY_STATUSES,
  STAY_STATUS_KEYS,
} from "@/lib/constants";
import { formatMoney } from "@/lib/format";
import { translator, type Lang } from "@/lib/i18n";
import type { FormState, PaymentStatus, RateKind, RoomOption, StayStatus } from "@/lib/types";

/** Initial values for every field (all strings, exactly as they appear in the inputs). */
export interface StayFormValues {
  first_name: string;
  last_name: string;
  phone: string;
  email: string;
  id_number: string;
  address: string;
  room_id: string;
  rate_kind: RateKind;
  check_in: string; // "YYYY-MM-DDTHH:mm" in the hotel's time zone
  expected_check_out: string;
  price_per_night: string; // the agreed price: per night, or the flat short-stay price
  payment_status: PaymentStatus;
  notes: string;
  status?: StayStatus; // edit mode only
}

interface StayFormProps {
  mode: "create" | "edit";
  rooms: RoomOption[];
  defaults: StayFormValues;
  /** The Server Action to run (createStay, or updateStay bound to a stay id). */
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  cancelHref: string;
  lang: Lang;
}

/** Whole 24-hour blocks between two "YYYY-MM-DDTHH:mm" values (minimum 1), or null if incomplete. */
function countNights(checkIn: string, checkOut: string): number | null {
  const start = Date.parse(`${checkIn}:00Z`);
  const end = Date.parse(`${checkOut}:00Z`);
  if (Number.isNaN(start) || Number.isNaN(end) || end <= start) return null;
  return Math.max(1, Math.ceil((end - start) / 86_400_000));
}

/** Add `hours` to a "YYYY-MM-DDTHH:mm" value, staying in the same wall clock. */
function addHours(local: string, hours: number): string {
  const ms = Date.parse(`${local}:00Z`);
  if (Number.isNaN(ms)) return local;
  return new Date(ms + hours * 3_600_000).toISOString().slice(0, 16);
}

/** Default length of a short stay when the desk switches to that rate. */
const SHORT_STAY_HOURS = 3;

/**
 * One form for both registering and editing a stay.
 * Layout: guest details, then stay details. Errors appear under the field they belong to.
 */
export function StayForm({ mode, rooms, defaults, action, cancelHref, lang }: StayFormProps) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const errors = state?.fieldErrors ?? {};
  const t = translator(lang);

  // Controlled fields: they drive the room type display, the rate and the live total.
  const [roomId, setRoomId] = useState(defaults.room_id);
  const [rateKind, setRateKind] = useState<RateKind>(defaults.rate_kind);
  const [price, setPrice] = useState(defaults.price_per_night);
  const [checkIn, setCheckIn] = useState(defaults.check_in);
  const [checkOut, setCheckOut] = useState(defaults.expected_check_out);

  const room = rooms.find((r) => r.id === roomId);
  const isShort = rateKind === "short";
  const nights = countNights(checkIn, checkOut);
  const priceNumber = Number(price);
  const priceValid = price !== "" && !Number.isNaN(priceNumber);
  // A short stay is one flat price; a nightly stay is price x nights.
  const estimatedTotal = isShort
    ? priceValid
      ? priceNumber
      : null
    : nights !== null && priceValid
      ? nights * priceNumber
      : null;

  /** The room's standard rate for the selected kind. */
  const rateOf = (r: RoomOption | undefined, kind: RateKind) =>
    r ? (kind === "short" ? r.price_short_stay : r.price_per_night) : undefined;

  function onRoomChange(nextId: string) {
    setRoomId(nextId);
    // When registering, suggest the room's standard rate. When editing, never overwrite the agreed price.
    if (mode === "create") {
      const rate = rateOf(rooms.find((r) => r.id === nextId), rateKind);
      if (rate !== undefined) setPrice(String(rate));
    }
  }

  function onRateKindChange(next: RateKind) {
    setRateKind(next);
    if (mode === "create") {
      const rate = rateOf(room, next);
      if (rate !== undefined) setPrice(String(rate));
      // A short stay is a few hours, not a night: propose a sensible check-out.
      if (next === "short") setCheckOut(addHours(checkIn, SHORT_STAY_HOURS));
    }
  }

  const invalid = (name: string) => (errors[name] ? "input input-invalid" : "input");

  return (
    <form
      className="space-y-6"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        // startTransition (rather than the form's `action` attribute) keeps typed values in place after an error.
        startTransition(() => formAction(formData));
      }}
    >
      {state?.error ? (
        <div role="alert" className="rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-800">
          {state.error}
        </div>
      ) : null}

      {/* ------------------------------ Guest ------------------------------ */}
      <fieldset className="panel p-5 sm:p-6">
        <legend className="sr-only">{t("form.guestInfo")}</legend>
        <h2 className="mb-4 font-serif text-lg font-semibold">{t("form.guest")}</h2>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("form.firstName")} htmlFor="first_name" error={errors.first_name}>
            <input id="first_name" name="first_name" defaultValue={defaults.first_name} autoComplete="off" className={invalid("first_name")} aria-invalid={!!errors.first_name} />
          </Field>
          <Field label={t("form.lastName")} htmlFor="last_name" error={errors.last_name}>
            <input id="last_name" name="last_name" defaultValue={defaults.last_name} autoComplete="off" className={invalid("last_name")} aria-invalid={!!errors.last_name} />
          </Field>
          <Field label={t("form.phone")} htmlFor="phone" error={errors.phone}>
            <input id="phone" name="phone" type="tel" inputMode="tel" defaultValue={defaults.phone} autoComplete="off" placeholder="+509 0000 0000" className={invalid("phone")} aria-invalid={!!errors.phone} />
          </Field>
          <Field label={t("form.email")} htmlFor="email" error={errors.email}>
            <input id="email" name="email" type="email" inputMode="email" defaultValue={defaults.email} autoComplete="off" className={invalid("email")} aria-invalid={!!errors.email} />
          </Field>
          <Field label={t("form.idNumber")} htmlFor="id_number" error={errors.id_number} hint={t("form.idHint")}>
            <input id="id_number" name="id_number" defaultValue={defaults.id_number} autoComplete="off" className={invalid("id_number")} aria-invalid={!!errors.id_number} />
          </Field>
          <Field label={t("form.address")} htmlFor="address" error={errors.address}>
            <input id="address" name="address" defaultValue={defaults.address} autoComplete="off" className={invalid("address")} aria-invalid={!!errors.address} />
          </Field>
        </div>
      </fieldset>

      {/* ------------------------------ Stay ------------------------------- */}
      <fieldset className="panel p-5 sm:p-6">
        <legend className="sr-only">{t("form.stayDetails")}</legend>
        <h2 className="mb-4 font-serif text-lg font-semibold">{t("form.stay")}</h2>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("form.roomNumber")} htmlFor="room_id" error={errors.room_id}>
            <select
              id="room_id"
              name="room_id"
              value={roomId}
              onChange={(event) => onRoomChange(event.target.value)}
              className={invalid("room_id")}
              aria-invalid={!!errors.room_id}
            >
              <option value="">{t("form.chooseRoom")}</option>
              {rooms.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.room_number} - {t(ROOM_TYPE_KEYS[r.room_type])}
                  {r.occupied ? t("form.occupiedNow") : ""}
                </option>
              ))}
            </select>
          </Field>

          <Field label={t("form.roomType")} htmlFor="room_type_display" hint={t("form.roomTypeHint")}>
            <input
              id="room_type_display"
              value={room ? t(ROOM_TYPE_KEYS[room.room_type]) : ""}
              placeholder={t("form.chooseRoomFirst")}
              readOnly
              tabIndex={-1}
              className="input bg-ink-50 text-ink-700"
            />
          </Field>

          {/* Nightly rate or short stay */}
          <Field label={t("form.rateKind")} htmlFor="rate_kind" error={errors.rate_kind} hint={t("form.rateKindHint")}>
            <select
              id="rate_kind"
              name="rate_kind"
              value={rateKind}
              onChange={(event) => onRateKindChange(event.target.value as RateKind)}
              className={invalid("rate_kind")}
              aria-invalid={!!errors.rate_kind}
            >
              {RATE_KINDS.map((value) => (
                <option key={value} value={value}>
                  {t(RATE_KIND_KEYS[value])}
                </option>
              ))}
            </select>
          </Field>

          <Field
            label={isShort ? t("form.priceShortStay") : t("form.pricePerNight")}
            htmlFor="price_per_night"
            error={errors.price_per_night}
          >
            <input
              id="price_per_night"
              name="price_per_night"
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              value={price}
              onChange={(event) => setPrice(event.target.value)}
              className={invalid("price_per_night")}
              aria-invalid={!!errors.price_per_night}
            />
          </Field>

          <Field label={t("form.checkIn")} htmlFor="check_in" error={errors.check_in}>
            <input
              id="check_in"
              name="check_in"
              type="datetime-local"
              step={60}
              value={checkIn}
              onChange={(event) => setCheckIn(event.target.value)}
              className={invalid("check_in")}
              aria-invalid={!!errors.check_in}
            />
          </Field>
          <Field label={t("form.checkOut")} htmlFor="expected_check_out" error={errors.expected_check_out}>
            <input
              id="expected_check_out"
              name="expected_check_out"
              type="datetime-local"
              step={60}
              value={checkOut}
              onChange={(event) => setCheckOut(event.target.value)}
              className={invalid("expected_check_out")}
              aria-invalid={!!errors.expected_check_out}
            />
          </Field>

          <Field label={t("form.paymentStatus")} htmlFor="payment_status" error={errors.payment_status}>
            <select id="payment_status" name="payment_status" defaultValue={defaults.payment_status} className={invalid("payment_status")}>
              {PAYMENT_STATUSES.map((value) => (
                <option key={value} value={value}>
                  {t(PAYMENT_STATUS_KEYS[value])}
                </option>
              ))}
            </select>
          </Field>

          {mode === "edit" ? (
            <Field label={t("form.stayStatus")} htmlFor="status" error={errors.status} hint={t("form.stayStatusHint")}>
              <select id="status" name="status" defaultValue={defaults.status} className={invalid("status")}>
                {STAY_STATUSES.map((value) => (
                  <option key={value} value={value}>
                    {t(STAY_STATUS_KEYS[value])}
                  </option>
                ))}
              </select>
            </Field>
          ) : null}

          <Field label={t("form.notes")} htmlFor="notes" error={errors.notes} className="sm:col-span-2">
            <textarea id="notes" name="notes" rows={3} defaultValue={defaults.notes} className={invalid("notes")} />
          </Field>
        </div>

        {/* Live estimate so the desk can quote the total before saving */}
        <div className="mt-5 flex flex-wrap items-baseline justify-between gap-2 rounded-md bg-ink-50 px-4 py-3 text-sm">
          <span className="text-ink-700">
            {isShort
              ? t("form.shortStay")
              : nights !== null
                ? t("form.nights", { n: nights })
                : t("form.enterDates")}
          </span>
          {estimatedTotal !== null ? (
            <span className="font-serif text-xl font-semibold text-ink-950">{formatMoney(estimatedTotal, lang)}</span>
          ) : null}
        </div>
      </fieldset>

      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton pending={pending} pendingLabel={t("common.saving")}>
          {mode === "create" ? t("form.register") : t("form.saveChanges")}
        </SubmitButton>
        <Link href={cancelHref} className="btn-secondary">
          {t("common.discard")}
        </Link>
      </div>
    </form>
  );
}
