"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { cancelStay, checkInStay, checkOutStay } from "@/app/(app)/stays/actions";
import { IconCheck, IconEdit, IconSpinner } from "@/components/icons";
import { translator, type Lang } from "@/lib/i18n";
import type { ActionResult, StayStatus } from "@/lib/types";

/**
 * Row/card buttons for a stay:
 *   pending     -> Check in (reception only), Cancel booking, Edit
 *   active      -> Check out (one click), Edit
 *   checked_out -> Edit
 *   cancelled   -> Edit
 * The page refreshes itself after each action (the Server Action revalidates it).
 */
export function StayActions({
  stayId,
  status,
  lang = "fr",
  canCheckIn = true,
}: {
  stayId: string;
  status: StayStatus;
  lang?: Lang;
  /** The administrator does not register arrivals; reception does. */
  canCheckIn?: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const t = translator(lang);

  function run(action: (id: string) => Promise<ActionResult>) {
    setError(null);
    startTransition(async () => {
      const result = await action(stayId);
      if (result?.error) setError(result.error);
    });
  }

  return (
    <div className="flex flex-col items-start gap-1.5 md:items-end">
      <div className="flex flex-wrap items-center gap-2">
        {status === "active" && (
          <button type="button" onClick={() => run(checkOutStay)} disabled={pending} className="btn-primary btn-sm">
            {pending ? <IconSpinner width={14} height={14} /> : <IconCheck width={14} height={14} />}
            {t("action.checkOut")}
          </button>
        )}

        {status === "pending" && (
          <>
            {canCheckIn ? (
              <button type="button" onClick={() => run(checkInStay)} disabled={pending} className="btn-primary btn-sm">
                {pending ? <IconSpinner width={14} height={14} /> : <IconCheck width={14} height={14} />}
                {t("action.checkIn")}
              </button>
            ) : null}
            <button
              type="button"
              disabled={pending}
              className="btn-danger btn-sm"
              onClick={() => {
                if (window.confirm(t("action.confirmCancel"))) run(cancelStay);
              }}
            >
              {t("action.cancel")}
            </button>
          </>
        )}

        <Link href={`/stays/${stayId}/edit`} className="btn-secondary btn-sm">
          <IconEdit width={14} height={14} />
          {t("common.edit")}
        </Link>
      </div>

      {error ? (
        <p role="alert" className="max-w-xs text-xs font-medium text-rose-700 md:text-right">
          {error}
        </p>
      ) : null}
    </div>
  );
}
