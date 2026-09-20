import { z } from "zod";
import type { Translate } from "./i18n";
import { PAYMENT_STATUSES, RATE_KINDS, ROOM_TYPES, STAY_STATUSES } from "./constants";

/**
 * Form rules, in one place. Each schema is built for the current language so the
 * messages shown under the fields are in French (reception) or English (admin).
 */

/** "2026-09-18T14:30" - the value format of <input type="datetime-local">. */
const localDateTime = (message: string) => z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, message);

const money = (t: Translate, required: string) =>
  z
    .string()
    .trim()
    .min(1, required)
    .transform(Number)
    .pipe(
      z
        .number({ invalid_type_error: t("v.number") })
        .min(0, t("v.negative"))
        .max(1_000_000, t("v.tooHigh"))
    );

function stayFields(t: Translate) {
  return z.object({
    // --- Guest ---
    first_name: z.string().trim().min(1, t("v.firstName")).max(80, t("v.tooLong")),
    last_name: z.string().trim().min(1, t("v.lastName")).max(80, t("v.tooLong")),
    phone: z
      .string()
      .trim()
      .min(5, t("v.phone"))
      .max(30, t("v.tooLong"))
      .regex(/^[+()\d][\d\s().-]*$/, t("v.phoneFormat")),
    email: z.union([z.literal(""), z.string().trim().email(t("v.email")).max(120)]),
    id_number: z.string().trim().min(3, t("v.idNumber")).max(50, t("v.tooLong")),
    address: z.string().trim().min(3, t("v.address")).max(250, t("v.tooLong")),

    // --- Stay ---
    room_id: z.string().uuid(t("v.room")),
    rate_kind: z.enum(RATE_KINDS as [string, ...string[]], { message: t("v.rateKind") }),
    check_in: localDateTime(t("v.checkInDate")),
    expected_check_out: localDateTime(t("v.checkOutDate")),
    /** The agreed price: per night, or the flat short-stay price. */
    price_per_night: money(t, t("v.price")),
    payment_status: z.enum(PAYMENT_STATUSES as [string, ...string[]], { message: t("v.payment") }),
    notes: z.string().trim().max(500, t("v.notes")).optional(),
  });
}

/** Cross-field rule: check-out must come after check-in (same format => string compare works). */
const checkoutAfterCheckin = (d: { check_in: string; expected_check_out: string }) =>
  d.expected_check_out > d.check_in;

export function createStaySchema(t: Translate) {
  return stayFields(t).refine(checkoutAfterCheckin, {
    path: ["expected_check_out"],
    message: t("v.checkOutAfter"),
  });
}

export function editStaySchema(t: Translate) {
  return stayFields(t)
    .extend({ status: z.enum(STAY_STATUSES as [string, ...string[]], { message: t("v.status") }) })
    .refine(checkoutAfterCheckin, { path: ["expected_check_out"], message: t("v.checkOutAfter") });
}

/** Adding a room: number, type, and BOTH rates (nightly and short stay). */
export function roomSchema(t: Translate) {
  return z.object({
    room_number: z.string().trim().min(1, t("v.roomNumber")).max(10, t("v.roomNumberLong")),
    room_type: z.enum(ROOM_TYPES as [string, ...string[]], { message: t("v.roomType") }),
    price_per_night: money(t, t("v.rateNight")),
    price_short_stay: money(t, t("v.rateShort")),
  });
}

/** Changing an existing room's two rates. */
export function roomPricesSchema(t: Translate) {
  return z.object({
    price_per_night: money(t, t("v.rateNight")),
    price_short_stay: money(t, t("v.rateShort")),
  });
}

/** Collapse a ZodError into { fieldName: firstMessage } for inline display. */
export function toFieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "_form");
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

export const uuidSchema = z.string().uuid();
