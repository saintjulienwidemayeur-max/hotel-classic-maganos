"use client";

import { useEffect, useRef, useTransition } from "react";
import { signOut } from "@/app/login/actions";

/**
 * Locks the session after `minutes` without any touch, click, key press or scroll.
 * Used for the administrator, whose screens show every guest's personal details and the
 * takings: a forgotten open screen at the front desk should not stay open.
 * Pass 0 to disable.
 */
export function IdleLock({ minutes }: { minutes: number }) {
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [, startTransition] = useTransition();

  useEffect(() => {
    if (!minutes || minutes <= 0) return;
    const limit = minutes * 60 * 1000;
    const lock = () => startTransition(() => void signOut());
    const reset = () => {
      clearTimeout(timer.current);
      timer.current = setTimeout(lock, limit);
    };

    const events = ["pointerdown", "keydown", "scroll", "touchstart"] as const;
    events.forEach((name) => window.addEventListener(name, reset, { passive: true }));
    reset();

    return () => {
      events.forEach((name) => window.removeEventListener(name, reset));
      clearTimeout(timer.current);
    };
  }, [minutes]);

  return null;
}
