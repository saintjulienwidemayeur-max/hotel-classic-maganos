"use server";

/**
 * Receptionist accounts: a name and a personal 4-digit code each, managed by the
 * administrator. Codes are stored only as a salted hash (same scheme as the two
 * main codes). The sign-in screen matches the code and remembers the name, so every
 * transaction can be traced to the person who did it.
 */

import { revalidatePath } from "next/cache";
import { COMMON_CODES, getAccessConfig, hashPin, isPinShaped, matchPin, type AccessRole } from "@/lib/access";
import { getSession } from "@/lib/auth";
import { PIN_LENGTH } from "@/lib/constants";
import { friendlyDbError } from "@/lib/db-errors";
import { getT } from "@/lib/lang";
import { createClient } from "@/lib/supabase/server";
import { uuidSchema } from "@/lib/validation";
import type { ActionResult, FormState } from "@/lib/types";

async function requireAdminSession() {
  const { profile } = await getSession();
  return profile && profile.role === "admin" ? profile : null;
}

/** Checks a new code: right shape, not obvious, and not already used by anyone. */
async function checkNewCode(
  pin: string,
  confirm: string,
  t: Awaited<ReturnType<typeof getT>>["t"],
  ignoreReceptionistId?: string
): Promise<{ error: string; field: "pin" | "confirm" } | { hash: string }> {
  if (!isPinShaped(pin)) return { error: t("settings.codeDigits", { n: PIN_LENGTH }), field: "pin" };
  if (pin !== confirm) return { error: t("settings.codeMismatch"), field: "confirm" };
  if (COMMON_CODES.has(pin)) return { error: t("settings.codeCommon"), field: "pin" };

  const hash = hashPin(pin);
  const supabase = await createClient();

  const [{ data: storedRole }, { data: overrides }, { data: taken }] = await Promise.all([
    supabase.rpc("resolve_pin_hash", { p_hash: hash }),
    supabase.rpc("pin_override_roles"),
    supabase.from("receptionists").select("id").eq("pin_hash", hash).limit(1),
  ]);

  const { config } = getAccessConfig();
  const overridden = (Array.isArray(overrides) ? overrides : []) as AccessRole[];
  const usedByMain = storedRole === "admin" || storedRole === "reception" || (config ? matchPin(pin, config, overridden) !== null : false);
  const usedByOther = (taken ?? []).some((row) => row.id !== ignoreReceptionistId);

  if (usedByMain || usedByOther) return { error: t("recep.codeTaken"), field: "pin" };
  return { hash };
}

/** Add a receptionist with a name and a personal code. */
export async function createReceptionist(_prev: FormState, formData: FormData): Promise<FormState> {
  const { t } = await getT();
  if (!(await requireAdminSession())) return { error: t("settings.adminOnly") };

  const name = String(formData.get("full_name") ?? "").trim().replace(/\s+/g, " ");
  if (name.length < 2 || name.length > 60) {
    return { error: t("recep.nameInvalid"), fieldErrors: { full_name: t("recep.nameInvalid") } };
  }

  const checked = await checkNewCode(
    String(formData.get("pin") ?? "").trim(),
    String(formData.get("confirm") ?? "").trim(),
    t
  );
  if ("error" in checked) return { error: checked.error, fieldErrors: { [checked.field]: checked.error } };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("receptionists")
    .insert({ full_name: name, pin_hash: checked.hash })
    .select("id");

  if (error) return { error: friendlyDbError(error, t) };
  if (!data || data.length === 0) return { error: t("settings.codeNotSaved") };

  revalidatePath("/receptionists");
  return { success: true };
}

/** Give an existing receptionist a new code (forgotten or compromised). */
export async function setReceptionistCode(id: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const { t } = await getT();
  if (!(await requireAdminSession())) return { error: t("settings.adminOnly") };
  if (!uuidSchema.safeParse(id).success) return { error: t("err.generic") };

  const checked = await checkNewCode(
    String(formData.get("pin") ?? "").trim(),
    String(formData.get("confirm") ?? "").trim(),
    t,
    id
  );
  if ("error" in checked) return { error: checked.error, fieldErrors: { [checked.field]: checked.error } };

  const supabase = await createClient();
  const { data, error } = await supabase.from("receptionists").update({ pin_hash: checked.hash }).eq("id", id).select("id");

  if (error) return { error: friendlyDbError(error, t) };
  if (!data || data.length === 0) return { error: t("settings.codeNotSaved") };

  revalidatePath("/receptionists");
  return { success: true };
}

/** Switch a receptionist off (their code stops working at once) or back on. */
export async function setReceptionistActive(id: string, active: boolean): Promise<ActionResult> {
  const { t } = await getT();
  if (!(await requireAdminSession())) return { error: t("settings.adminOnly") };
  if (!uuidSchema.safeParse(id).success) return { error: t("err.generic") };

  const supabase = await createClient();
  const { data, error } = await supabase.from("receptionists").update({ is_active: active }).eq("id", id).select("id");

  if (error) return { error: friendlyDbError(error, t) };
  if (!data || data.length === 0) return { error: t("err.forbidden") };

  revalidatePath("/receptionists");
  return {};
}

/** Delete a receptionist. Past transactions keep their name. */
export async function deleteReceptionist(id: string): Promise<ActionResult> {
  const { t } = await getT();
  if (!(await requireAdminSession())) return { error: t("settings.adminOnly") };
  if (!uuidSchema.safeParse(id).success) return { error: t("err.generic") };

  const supabase = await createClient();
  const { data, error } = await supabase.from("receptionists").delete().eq("id", id).select("id");

  if (error) return { error: friendlyDbError(error, t) };
  if (!data || data.length === 0) return { error: t("err.forbidden") };

  revalidatePath("/receptionists");
  return {};
}
