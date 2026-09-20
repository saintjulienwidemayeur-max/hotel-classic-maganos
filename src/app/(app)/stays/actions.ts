"use server";

/**
 * Server Actions for stays.
 *
 * Every action:
 *   1. validates its input with zod (never trust the browser),
 *   2. runs the query as the signed-in user, so Row Level Security has the final say,
 *   3. returns a friendly message on failure instead of throwing.
 */

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { zonedLocalToUtc } from "@/lib/datetime";
import { friendlyDbError } from "@/lib/db-errors";
import { getT } from "@/lib/lang";
import { createStaySchema, editStaySchema, toFieldErrors, uuidSchema } from "@/lib/validation";
import type { ActionResult, FormState, RateKind, StayStatus } from "@/lib/types";

/** Pages whose data changes when a stay changes. */
function refreshPages() {
  revalidatePath("/dashboard");
  revalidatePath("/stays");
  revalidatePath("/rooms");
}

/* -------------------------------------------------------------------------- */
/*  Register a new stay (guest + stay in one form)                             */
/* -------------------------------------------------------------------------- */

export async function createStay(_prev: FormState, formData: FormData): Promise<FormState> {
  const { t } = await getT();

  const parsed = createStaySchema(t).safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: t("form.checkFields"), fieldErrors: toFieldErrors(parsed.error) };
  }
  const v = parsed.data;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // 1) Find-or-create the guest by ID number. A returning guest keeps one record,
  //    and their contact details are refreshed with whatever was typed today.
  const { data: guest, error: guestError } = await supabase
    .from("guests")
    .upsert(
      {
        first_name: v.first_name,
        last_name: v.last_name,
        phone: v.phone,
        email: v.email || null,
        id_number: v.id_number.toUpperCase(),
        address: v.address,
      },
      { onConflict: "id_number" }
    )
    .select("id")
    .single();

  if (guestError || !guest) return { error: friendlyDbError(guestError, t) };

  // 2) Create the stay. A check-in time in the future means the guest has not
  //    arrived yet, so the stay starts as "pending"; otherwise they are in-house.
  const checkIn = zonedLocalToUtc(v.check_in);
  const expectedCheckOut = zonedLocalToUtc(v.expected_check_out);
  const status: StayStatus = checkIn.getTime() > Date.now() ? "pending" : "active";

  const { error: stayError } = await supabase.from("stays").insert({
    guest_id: guest.id,
    room_id: v.room_id,
    status,
    check_in: checkIn.toISOString(),
    expected_check_out: expectedCheckOut.toISOString(),
    // price_per_night holds the agreed price: per night, or the flat short-stay price.
    price_per_night: v.price_per_night,
    rate_kind: v.rate_kind as RateKind,
    payment_status: v.payment_status,
    notes: v.notes || null,
  });

  if (stayError) return { error: friendlyDbError(stayError, t) };

  refreshPages();
  redirect("/stays?notice=created"); // redirect() must stay outside try/catch
}

/* -------------------------------------------------------------------------- */
/*  Edit an existing stay                                                      */
/* -------------------------------------------------------------------------- */

export async function updateStay(stayId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const { t } = await getT();

  if (!uuidSchema.safeParse(stayId).success) return { error: t("action.notFound") };

  const parsed = editStaySchema(t).safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: t("form.checkFields"), fieldErrors: toFieldErrors(parsed.error) };
  }
  const v = parsed.data;

  const supabase = await createClient();

  // Read the guest from the database instead of trusting an id sent by the browser.
  const { data: existing } = await supabase
    .from("stays")
    .select("guest_id, actual_check_out")
    .eq("id", stayId)
    .maybeSingle();
  if (!existing) return { error: t("action.notFound") };

  // 1) Guest details. (Two separate calls are not atomic; if the second fails the
  //    guest edit is kept, which is harmless and can simply be resubmitted.)
  const { error: guestError } = await supabase
    .from("guests")
    .update({
      first_name: v.first_name,
      last_name: v.last_name,
      phone: v.phone,
      email: v.email || null,
      id_number: v.id_number.toUpperCase(),
      address: v.address,
    })
    .eq("id", existing.guest_id);
  if (guestError) return { error: friendlyDbError(guestError, t) };

  // 2) Stay details. Status drives the check-out timestamp:
  //    checked_out -> keep the recorded time (or stamp "now"); anything else clears it.
  const actualCheckOut =
    v.status === "checked_out" ? (existing.actual_check_out ?? new Date().toISOString()) : null;

  const { data: updated, error: stayError } = await supabase
    .from("stays")
    .update({
      room_id: v.room_id,
      status: v.status,
      check_in: zonedLocalToUtc(v.check_in).toISOString(),
      expected_check_out: zonedLocalToUtc(v.expected_check_out).toISOString(),
      actual_check_out: actualCheckOut,
      price_per_night: v.price_per_night,
      rate_kind: v.rate_kind as RateKind,
      payment_status: v.payment_status,
      notes: v.notes || null,
    })
    .eq("id", stayId)
    .select("id");

  if (stayError) return { error: friendlyDbError(stayError, t) };
  if (!updated || updated.length === 0) return { error: t("err.stayGone") };

  refreshPages();
  redirect("/stays?notice=updated");
}

/* -------------------------------------------------------------------------- */
/*  One-click status changes                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Moves a stay from one status to another. The `.eq("status", from)` guard makes
 * the change safe against double-clicks and two staff members acting at once:
 * if the stay is no longer in the expected state, nothing is updated.
 */
async function transition(
  stayId: string,
  from: StayStatus,
  patch: Record<string, unknown>,
  staleKey: "action.staleCheckOut" | "action.stalePending"
): Promise<ActionResult> {
  const { t } = await getT();
  if (!uuidSchema.safeParse(stayId).success) return { error: t("action.notFound") };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("stays")
    .update(patch)
    .eq("id", stayId)
    .eq("status", from)
    .select("id");

  if (error) return { error: friendlyDbError(error, t) };
  if (!data || data.length === 0) return { error: t(staleKey) };

  refreshPages();
  return {};
}

/** Active -> Checked out, stamped with the current time. */
export async function checkOutStay(stayId: string): Promise<ActionResult> {
  return transition(
    stayId,
    "active",
    { status: "checked_out", actual_check_out: new Date().toISOString() },
    "action.staleCheckOut"
  );
}

/** Pending -> Active. If the guest arrives early, the check-in time moves up to now. */
export async function checkInStay(stayId: string): Promise<ActionResult> {
  const { t } = await getT();
  if (!uuidSchema.safeParse(stayId).success) return { error: t("action.notFound") };

  const supabase = await createClient();
  const { data: stay } = await supabase.from("stays").select("check_in").eq("id", stayId).maybeSingle();
  if (!stay) return { error: t("action.notFound") };

  const now = new Date();
  const scheduled = new Date(stay.check_in);

  return transition(
    stayId,
    "pending",
    { status: "active", check_in: (scheduled > now ? now : scheduled).toISOString() },
    "action.stalePending"
  );
}

/** Pending -> Cancelled. Records are never deleted, so the history stays complete. */
export async function cancelStay(stayId: string): Promise<ActionResult> {
  return transition(
    stayId,
    "pending",
    { status: "cancelled", actual_check_out: null },
    "action.stalePending"
  );
}
