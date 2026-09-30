import { cookies } from "next/headers";
import { getSession } from "./auth";
import { signValue, verifyValue } from "./access";

/**
 * WHO is acting. Reception staff share one database account, so the receptionist's
 * name travels in a signed, server-only cookie set at sign-in (see login/actions.ts).
 * Every stay action stamps that name on the record; the administrator reads it back.
 */
export const ACTOR_COOKIE = "maganos_actor";
const ACTOR_MAX_AGE = 60 * 60 * 14; // a long shift

const cookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  path: "/",
  secure: process.env.NODE_ENV === "production",
};

export async function rememberActor(name: string) {
  const store = await cookies();
  store.set(ACTOR_COOKIE, signValue(JSON.stringify({ name })), { ...cookieOptions, maxAge: ACTOR_MAX_AGE });
}

export async function forgetActor() {
  const store = await cookies();
  store.set(ACTOR_COOKIE, "", { ...cookieOptions, maxAge: 0 });
}

/** The name to stamp on a transaction: "Administrateur", the receptionist's name, or a generic label. */
export async function getActorName(): Promise<string> {
  const { profile } = await getSession();
  if (profile?.role === "admin") return "Administrateur";

  const store = await cookies();
  const payload = verifyValue(store.get(ACTOR_COOKIE)?.value);
  if (payload) {
    try {
      const { name } = JSON.parse(payload) as { name?: string };
      if (typeof name === "string" && name.trim()) return name.trim().slice(0, 80);
    } catch {
      /* fall through */
    }
  }
  return "Réception";
}
