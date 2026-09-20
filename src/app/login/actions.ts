"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getAccessConfig, hashPin, isPinShaped, matchPin, type AccessRole } from "@/lib/access";
import { PIN_LENGTH } from "@/lib/constants";
import { translator } from "@/lib/i18n";
import {
  MAX_FAILURES_PER_CLIENT,
  checkLock,
  clientKeyFromHeaders,
  recordFailure,
  recordSuccess,
} from "@/lib/pin-guard";
import { createClient } from "@/lib/supabase/server";
import type { FormState } from "@/lib/types";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** The sign-in screen is always in French: reception uses it every day. */
const t = translator("fr");

const lockedMessage = (seconds: number) => t("login.tooMany", { n: Math.max(1, Math.ceil(seconds / 60)) });

/**
 * Access-code sign-in.
 *
 *  1. Refuse if this client (or the whole server) is locked out after too many wrong codes.
 *  2. Ask the database whether the code matches a code the administrator set in the
 *     app; if not, fall back to the codes in .env.local (for roles with no stored code).
 *  3. Sign in to Supabase as the matching account (credentials come from server-only env vars).
 *  4. Double-check that the account really has the role that code promises, so the reception
 *     code can never open an administrator session by a set-up mistake.
 */
export async function signInWithPin(_prev: FormState, formData: FormData): Promise<FormState> {
  const pin = String(formData.get("pin") ?? "").trim();
  if (!isPinShaped(pin)) return { error: t("login.codeLength", { n: PIN_LENGTH }) };

  const { config, problems } = getAccessConfig();
  if (!config) {
    // Details go to the server log only; visitors just learn that setup is unfinished.
    console.error(`[access] Access codes are not configured: ${problems.join("; ")}`);
    const setup = t("login.notConfigured");
    // While developing (npm run dev) it is more useful to say what is missing; never do that in production.
    return { error: process.env.NODE_ENV === "production" ? setup : `${setup} (${problems.join("; ")})` };
  }

  const client = clientKeyFromHeaders(await headers());

  const lock = checkLock(client);
  if (lock.locked) return { error: lockedMessage(lock.retryAfterSeconds) };

  const supabase = await createClient();

  // Codes changed in the app live in the database (as a hash); the env file is the fallback.
  const [storedRoleResult, overridesResult] = await Promise.all([
    supabase.rpc("resolve_pin_hash", { p_hash: hashPin(pin) }),
    supabase.rpc("pin_override_roles"),
  ]);

  const stored = storedRoleResult.data;
  const overridden = (Array.isArray(overridesResult.data) ? overridesResult.data : []) as AccessRole[];

  const role: AccessRole | null =
    stored === "admin" || stored === "reception" ? stored : matchPin(pin, config, overridden);

  if (!role) {
    recordFailure(client);
    await sleep(400); // slows down automated guessing a little more
    const after = checkLock(client);
    if (after.locked) return { error: lockedMessage(after.retryAfterSeconds) };
    const left = Math.min(after.attemptsLeft, MAX_FAILURES_PER_CLIENT);
    return { error: t("login.wrongCode", { n: left }) };
  }

  const account = config[role];
  const { data, error } = await supabase.auth.signInWithPassword({ email: account.email, password: account.password });

  if (error || !data.user) {
    console.error(`[access] The ${role} code was right but the ${role} account could not sign in: ${error?.message}`);
    if (error?.status === 429) return { error: t("login.busy") };
    if (error?.status && error.status >= 400 && error.status < 500) return { error: t("login.accountMissing") };
    return { error: t("login.unreachable") };
  }

  // The role the database has on file must match the role this code stands for.
  const expectedRole = role === "admin" ? "admin" : "staff";
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, is_active")
    .eq("id", data.user.id)
    .maybeSingle();

  if (!profile || !profile.is_active || profile.role !== expectedRole) {
    await supabase.auth.signOut();
    console.error(`[access] Account ${account.email} has role "${profile?.role ?? "none"}" but the ${role} code needs "${expectedRole}".`);
    return { error: t("login.wrongRole") };
  }

  recordSuccess(client);
  // The administrator lands on the overview; reception lands straight on the check-in form.
  redirect(role === "admin" ? "/dashboard" : "/stays/new");
}

/** Ends the session ("Lock") and clears the auth cookies. */
export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
