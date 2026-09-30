"use client";

import { useEffect } from "react";

/** Registers the service worker (required for the app to be installable). */
export function PwaRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      /* Not installable in this browser; the app still works normally. */
    });
  }, []);

  return null;
}
