import type { ReactNode } from "react";

/** One cell of a "ledger strip": label, big serif number, small note underneath. */
export function Metric({
  label,
  value,
  note,
  alert = false,
}: {
  label: string;
  value: ReactNode;
  note?: string;
  alert?: boolean;
}) {
  return (
    <div className="-mb-px -mr-px min-w-0 border-b border-r border-ink-100 px-5 py-5">
      <dt className="truncate text-sm text-ink-600">{label}</dt>
      <dd className="mt-1 break-words font-serif text-2xl font-semibold leading-tight tabular-nums text-ink-950 sm:text-3xl 2xl:text-2xl">{value}</dd>
      {note ? <p className={`mt-1 text-xs ${alert ? "font-medium text-rose-700" : "text-ink-500"}`}>{note}</p> : null}
    </div>
  );
}
