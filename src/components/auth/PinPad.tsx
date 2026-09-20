"use client";

import { startTransition, useActionState, useEffect, useRef, useState } from "react";
import { signInWithPin } from "@/app/login/actions";
import { IconSpinner } from "@/components/icons";
import { PIN_LENGTH } from "@/lib/constants";
import { translator } from "@/lib/i18n";

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9"] as const;

/** The keypad is always in French (reception and the administrator both use it). */
const t = translator("fr");

/**
 * Access-code keypad: big touch targets for a phone or tablet at the desk, and the
 * physical keyboard works too (digits, Backspace, Escape). The code is submitted
 * automatically when the last digit is entered.
 */
export function PinPad() {
  const [state, formAction, pending] = useActionState(signInWithPin, undefined);
  const [pin, setPinState] = useState("");

  // Refs give the key handlers the latest values without re-registering listeners.
  const pinRef = useRef("");
  const pendingRef = useRef(false);
  pendingRef.current = pending;

  const setPin = (value: string) => {
    pinRef.current = value;
    setPinState(value);
  };

  const submit = (value: string) => {
    const formData = new FormData();
    formData.set("pin", value);
    startTransition(() => formAction(formData));
  };

  const press = (digit: string) => {
    if (pendingRef.current || pinRef.current.length >= PIN_LENGTH) return;
    const next = pinRef.current + digit;
    setPin(next);
    if (next.length === PIN_LENGTH) submit(next);
  };
  const backspace = () => {
    if (!pendingRef.current) setPin(pinRef.current.slice(0, -1));
  };
  const clear = () => {
    if (!pendingRef.current) setPin("");
  };

  // A finished attempt that came back with an error: empty the dots so the next try starts fresh.
  useEffect(() => {
    if (state?.error) {
      pinRef.current = "";
      setPinState("");
    }
  }, [state]);

  // Physical keyboard support.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (/^\d$/.test(event.key)) press(event.key);
      else if (event.key === "Backspace") backspace();
      else if (event.key === "Escape") clear();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // press/backspace/clear only touch refs and stable setters
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const keyClass =
    "flex h-16 items-center justify-center rounded-xl border border-ink-200 bg-white font-serif text-2xl font-semibold text-ink-900 " +
    "shadow-sm transition active:scale-95 active:bg-ink-100 hover:border-ink-300 hover:bg-ink-50 " +
    "focus:outline-none focus-visible:ring-2 focus-visible:ring-lagoon-500 disabled:opacity-50";

  return (
    <div>
      {/* The dots: filled = digit entered. Errors shake them once (skipped for reduced motion). */}
      <div
        key={state?.error ? `err-${pin.length}-${state.error}` : "ok"}
        className={`flex justify-center gap-4 ${state?.error ? "pin-shake" : ""}`}
        role="img"
        aria-label={t("login.digitsEntered", { a: pin.length, b: PIN_LENGTH })}
      >
        {Array.from({ length: PIN_LENGTH }, (_, index) => (
          <span
            key={index}
            className={`h-4 w-4 rounded-full border-2 transition-colors ${
              index < pin.length ? "border-brass-500 bg-brass-400" : "border-ink-300 bg-white"
            }`}
          />
        ))}
      </div>

      <div className="mt-5 min-h-[3rem]" aria-live="polite">
        {state?.error ? (
          <p role="alert" className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-center text-sm text-rose-800">
            {state.error}
          </p>
        ) : pending ? (
          <p className="flex items-center justify-center gap-2 text-sm text-ink-600">
            <IconSpinner width={16} height={16} /> {t("login.checking")}
          </p>
        ) : (
          <p className="text-center text-sm text-ink-500">{t("login.enterCode", { n: PIN_LENGTH })}</p>
        )}
      </div>

      <div className="mx-auto mt-2 grid max-w-xs grid-cols-3 gap-3">
        {KEYS.map((digit) => (
          <button key={digit} type="button" className={keyClass} onClick={() => press(digit)} disabled={pending}>
            {digit}
          </button>
        ))}
        <button
          type="button"
          className={`${keyClass} !font-sans !text-sm !font-medium text-ink-600`}
          onClick={clear}
          disabled={pending || pin.length === 0}
        >
          {t("login.clear")}
        </button>
        <button type="button" className={keyClass} onClick={() => press("0")} disabled={pending}>
          0
        </button>
        <button
          type="button"
          aria-label={t("login.deleteDigit")}
          className={`${keyClass} !font-sans !text-lg text-ink-600`}
          onClick={backspace}
          disabled={pending || pin.length === 0}
        >
          &#9003;
        </button>
      </div>
    </div>
  );
}
