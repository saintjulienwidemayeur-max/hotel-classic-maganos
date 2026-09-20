import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabaseEnv } from "./config";

/**
 * Supabase client for Server Components, Server Actions and Route Handlers.
 *
 * The session lives in HTTP-only cookies, so the browser never touches Supabase
 * directly and no access token is exposed to client-side JavaScript. Every query
 * runs as the signed-in user, which means Row Level Security is always enforced.
 */
export async function createClient() {
  const cookieStore = await cookies();
  const { url, anonKey } = getSupabaseEnv();

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          // httpOnly: @supabase/ssr defaults to false (so a browser client can read the token).
          // This app never uses a browser client, so keep the token out of reach of page scripts.
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, { ...options, httpOnly: true }));
        } catch {
          // Called from a Server Component, where cookies are read-only.
          // Safe to ignore: the middleware refreshes the session on every request.
        }
      },
    },
  });
}
