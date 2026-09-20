"use server";

/**
 * Server Actions for rooms. Only administrators may change rooms or rates; the
 * database enforces that through Row Level Security, and the UI hides the
 * controls from everyone else.
 */

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { friendlyDbError } from "@/lib/db-errors";
import { getT } from "@/lib/lang";
import { roomPricesSchema, roomSchema, toFieldErrors, uuidSchema } from "@/lib/validation";
import type { ActionResult, FormState } from "@/lib/types";

function refreshPages() {
  revalidatePath("/rooms");
  revalidatePath("/dashboard");
  revalidatePath("/stays/new");
}

/** Add a room, with its nightly rate AND its short-stay rate. */
export async function createRoom(_prev: FormState, formData: FormData): Promise<FormState> {
  const { t } = await getT();

  const parsed = roomSchema(t).safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: t("form.checkFields"), fieldErrors: toFieldErrors(parsed.error) };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("rooms")
    .insert({
      room_number: parsed.data.room_number,
      room_type: parsed.data.room_type,
      price_per_night: parsed.data.price_per_night,
      price_short_stay: parsed.data.price_short_stay,
    })
    .select("id");

  if (error) return { error: friendlyDbError(error, t) };
  if (!data || data.length === 0) return { error: t("rooms.adminOnlyAdd") };

  refreshPages();
  return { success: true };
}

/**
 * Change an existing room's two rates. Stays already registered keep the price
 * that was agreed with the guest (each stay stores its own copy).
 */
export async function updateRoomPrices(roomId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const { t } = await getT();

  if (!uuidSchema.safeParse(roomId).success) return { error: t("err.generic") };

  const parsed = roomPricesSchema(t).safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: t("form.checkFields"), fieldErrors: toFieldErrors(parsed.error) };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("rooms")
    .update({
      price_per_night: parsed.data.price_per_night,
      price_short_stay: parsed.data.price_short_stay,
    })
    .eq("id", roomId)
    .select("id");

  if (error) return { error: friendlyDbError(error, t) };
  if (!data || data.length === 0) return { error: t("rooms.adminOnlyChange") };

  refreshPages();
  return { success: true };
}

/** Takes a room out of service (or puts it back). A room with a guest in it cannot be taken out. */
export async function setRoomActive(roomId: string, active: boolean): Promise<ActionResult> {
  const { t } = await getT();

  if (!uuidSchema.safeParse(roomId).success) return { error: t("err.generic") };

  const supabase = await createClient();

  if (!active) {
    const { data: occupant } = await supabase
      .from("stays")
      .select("id")
      .eq("room_id", roomId)
      .eq("status", "active")
      .limit(1);
    if (occupant && occupant.length > 0) return { error: t("rooms.occupiedCannotClose") };
  }

  const { data, error } = await supabase.from("rooms").update({ is_active: active }).eq("id", roomId).select("id");

  if (error) return { error: friendlyDbError(error, t) };
  if (!data || data.length === 0) return { error: t("rooms.adminOnlyChange") };

  refreshPages();
  return {};
}
