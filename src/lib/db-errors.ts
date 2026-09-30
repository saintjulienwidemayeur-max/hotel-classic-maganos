import type { Translate } from "./i18n";

/**
 * Turns raw Postgres/PostgREST errors into messages front-desk staff can act on,
 * in the language of the current screen.
 * Constraint names come from /supabase/migrations/*_schema.sql.
 */
export function friendlyDbError(error: { code?: string; message?: string } | null | undefined, t: Translate): string {
  if (!error) return t("err.generic");
  const message = error.message ?? "";
  // Shows up in the server logs (Render -> Logs) so the real cause is never hidden.
  console.error("[db]", error.code, message);

  switch (error.code) {
    case "23P01": // exclusion_violation: stays_no_overlapping_bookings
      return t("err.overlap");

    case "23505": // unique_violation
      if (message.includes("stays_one_active_per_room")) return t("err.roomBusy");
      if (message.includes("guests_id_number_key")) return t("err.idTaken");
      if (message.includes("rooms_room_number_key")) return t("err.roomExists");
      return t("err.duplicate");

    case "23514": // check_violation
      return t("err.values");

    case "42501": // insufficient_privilege (RLS)
      return t("err.forbidden");

    case "42703": // undefined_column
    case "42P01": // undefined_table
    case "PGRST204": // column missing from the API schema cache
    case "PGRST205": // table missing from the API schema cache
      return t("err.dbOutdated");

    default:
      return t("err.saving");
  }
}
