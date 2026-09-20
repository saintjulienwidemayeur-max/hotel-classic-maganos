import type { MessageKey } from "./i18n";
import type { PaymentStatus, RateKind, RoomType, StaffRole, StayStatus } from "./types";

/**
 * Enum values and the translation key that labels each of them.
 * The label itself comes from t(...) so every screen follows the current language.
 */
export const STAY_STATUS_KEYS: Record<StayStatus, MessageKey> = {
  pending: "status.pending",
  active: "status.active",
  checked_out: "status.checked_out",
  cancelled: "status.cancelled",
};

export const PAYMENT_STATUS_KEYS: Record<PaymentStatus, MessageKey> = {
  unpaid: "payment.unpaid",
  partial: "payment.partial",
  paid: "payment.paid",
};

/** The hotel has exactly two kinds of room. */
export const ROOM_TYPE_KEYS: Record<RoomType, MessageKey> = {
  single: "roomType.single",
  double: "roomType.double",
};

/** How a stay is billed: per night, or one flat short-stay price. */
export const RATE_KIND_KEYS: Record<RateKind, MessageKey> = {
  night: "rate.night",
  short: "rate.short",
};

export const ROOM_TYPES = Object.keys(ROOM_TYPE_KEYS) as RoomType[];
export const PAYMENT_STATUSES = Object.keys(PAYMENT_STATUS_KEYS) as PaymentStatus[];
export const STAY_STATUSES = Object.keys(STAY_STATUS_KEYS) as StayStatus[];
export const RATE_KINDS = Object.keys(RATE_KIND_KEYS) as RateKind[];

/** Rows per page on the Stays and Guests screens. */
export const PAGE_SIZE = 15;

/** Digits in an access code. The keypad submits automatically once this many are entered. */
export const PIN_LENGTH = 4;

/** What each role is called on screen. */
export const ROLE_KEYS: Record<StaffRole, MessageKey> = {
  admin: "role.admin",
  staff: "role.staff",
};
