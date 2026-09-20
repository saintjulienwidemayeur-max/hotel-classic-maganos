import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseEnv } from "./config";

/**
 * Runs on every request (see /middleware.ts):
 *  1. Refreshes the Supabase session cookie when it is close to expiring.
 *  2. Sends signed-out visitors to /login and signed-in users away from it.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const { url, anonKey } = getSupabaseEnv();

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, { ...options, httpOnly: true })
        );
      },
    },
  });

  // getUser() re-validates the token with Supabase (unlike getSession(), which
  // only trusts the cookie), so it is the right call for access decisions.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isLoginPage = request.nextUrl.pathname.startsWith("/login");

  if (!user && !isLoginPage) {
    return redirectTo(request, "/login", response);
  }
  if (user && isLoginPage) {
    return redirectTo(request, "/", response);
  }
  return response;
}

/** Redirect while keeping any refreshed session cookies that were set on `from`. */
function redirectTo(request: NextRequest, pathname: string, from: NextResponse) {
  const target = request.nextUrl.clone();
  target.pathname = pathname;
  target.search = "";
  const redirect = NextResponse.redirect(target);
  from.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
  return redirect;
}
