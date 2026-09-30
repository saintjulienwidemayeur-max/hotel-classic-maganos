"use client";

import { useEffect, useState } from "react";

/**
 * Greeting shown once after signing in (the page is opened with ?welcome=1).
 * The parameter is removed from the address bar straight away, so a refresh does not show it again.
 */
export function WelcomeBanner({
  message,
  detail,
  closeLabel,
}: {
  message: string;
  detail?: string;
  closeLabel: string;
}) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.has("welcome")) {
      url.searchParams.delete("welcome");
      window.history.replaceState(null, "", url.pathname + url.search + url.hash);
    }
    const timer = window.setTimeout(() => setVisible(false), 25_000);
    return () => window.clearTimeout(timer);
  }, []);

  if (!visible) return null;

  return (
    <div
      role="status"
      className="mb-6 flex items-start justify-between gap-4 rounded-md border border-brass-300 bg-brass-50 px-5 py-4"
    >
      <div>
        <p className="font-serif text-lg font-semibold text-ink-950">{message}</p>
        {detail ? <p className="mt-1 text-sm text-ink-700">{detail}</p> : null}
      </div>
      <button
        type="button"
        onClick={() => setVisible(false)}
        className="shrink-0 text-xs font-medium underline underline-offset-2 text-ink-600 hover:text-ink-950"
      >
        {closeLabel}
      </button>
    </div>
  );
}
