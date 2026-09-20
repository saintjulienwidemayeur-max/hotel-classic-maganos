"use client";

import { translator } from "@/lib/i18n";

/** Catches unexpected errors on any signed-in page and offers a retry. */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = translator("fr");

  return (
    <div className="panel mx-auto max-w-md p-8 text-center">
      <h1 className="font-serif text-2xl font-semibold">{t("err.pageTitle")}</h1>
      <p className="mt-2 text-sm text-ink-600">
        {t("err.pageBody")}
        {process.env.NODE_ENV === "development" ? ` (${error.message})` : ""}
      </p>
      <button onClick={reset} className="btn-primary mt-6">
        {t("err.retry")}
      </button>
    </div>
  );
}
