import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";

/**
 * Resolves who is signed in and whether they may use the app.
 * Wrapped in React's cache() so layout + page share one lookup per request.
 *
 *  - user    : the Supabase Auth user (null when signed out)
 *  - profile : the staff profile (null when the account has no profile, or was deactivated)
 */
export const getSession = cache(async (): Promise<{ profile: Profile | null; signedIn: boolean }> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { profile: null, signedIn: false };

  const { data } = await supabase
    .from("profiles")
    .select("id, full_name, role, is_active")
    .eq("id", user.id)
    .maybeSingle();

  if (!data || !data.is_active) return { profile: null, signedIn: true };

  return { profile: { ...data, email: user.email ?? "" } as Profile, signedIn: true };
});

/**
 * Guard for administrator-only pages. Reception staff are sent back to the overview.
 * (The database enforces the same rule for the report functions, so this is a second gate.)
 */
export async function requireAdmin(): Promise<Profile> {
  const { profile, signedIn } = await getSession();
  if (!signedIn) redirect("/login");
  if (!profile || profile.role !== "admin") redirect("/dashboard");
  return profile;
}
