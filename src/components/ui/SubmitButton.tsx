import type { ReactNode } from "react";
import { IconSpinner } from "@/components/icons";

/** Primary submit button with a built-in busy state. */
export function SubmitButton({
  pending,
  children,
  pendingLabel = "Saving...",
  className = "btn-primary",
}: {
  pending: boolean;
  children: ReactNode;
  pendingLabel?: string;
  className?: string;
}) {
  return (
    <button type="submit" className={className} disabled={pending} aria-busy={pending}>
      {pending ? (
        <>
          <IconSpinner width={16} height={16} />
          {pendingLabel}
        </>
      ) : (
        children
      )}
    </button>
  );
}
