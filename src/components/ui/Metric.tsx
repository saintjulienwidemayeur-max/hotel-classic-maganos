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
    <div className="px-5 py-5">
      <dt className="text-sm text-ink-600">{label}</dt>
      <dd className="mt-1 font-serif text-3xl font-semibold tabular-nums text-ink-950 sm:text-4xl">{value}</dd>
      {note ? <p className={`mt-1 text-xs ${alert ? "font-medium text-rose-700" : "text-ink-500"}`}>{note}</p> : null}
    </div>
  );
}
