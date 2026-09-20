import { PAYMENT_STATUS_KEYS, STAY_STATUS_KEYS } from "@/lib/constants";
import { translator, type Lang } from "@/lib/i18n";
import type { PaymentStatus, StayStatus } from "@/lib/types";

/** Colour + dot + text: status is never communicated by colour alone. */
const STAY_STYLES: Record<StayStatus, { pill: string; dot: string }> = {
  active: { pill: "bg-emerald-50 text-emerald-800", dot: "bg-emerald-500" },
  pending: { pill: "bg-amber-50 text-amber-800", dot: "bg-amber-500" },
  checked_out: { pill: "bg-ink-100 text-ink-700", dot: "bg-ink-400" },
  cancelled: { pill: "bg-rose-50 text-rose-800", dot: "bg-rose-500" },
};

export function StatusBadge({ status, lang = "fr" }: { status: StayStatus; lang?: Lang }) {
  const style = STAY_STYLES[status];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded px-2 py-0.5 text-xs font-medium ${style.pill}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} aria-hidden="true" />
      {translator(lang)(STAY_STATUS_KEYS[status])}
    </span>
  );
}

const PAYMENT_STYLES: Record<PaymentStatus, string> = {
  paid: "border-emerald-200 text-emerald-800",
  partial: "border-amber-300 text-amber-800",
  unpaid: "border-rose-200 text-rose-700",
};

/** Outlined (not filled) so it reads as a different kind of information than the stay status. */
export function PaymentBadge({ status, lang = "fr" }: { status: PaymentStatus; lang?: Lang }) {
  return (
    <span className={`inline-flex items-center rounded border bg-white px-2 py-0.5 text-xs font-medium ${PAYMENT_STYLES[status]}`}>
      {translator(lang)(PAYMENT_STATUS_KEYS[status])}
    </span>
  );
}
