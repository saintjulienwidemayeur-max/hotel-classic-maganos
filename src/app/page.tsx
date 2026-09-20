import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";

/**
 * The root URL sends each role to its own first screen:
 *   administrator -> the overview
 *   reception     -> the check-in form (the screen they use all day)
 * Signed-out visitors are sent to /login by the middleware.
 */
export default async function Home() {
  const { profile, signedIn } = await getSession();
  if (!signedIn) redirect("/login");
  redirect(profile?.role === "admin" ? "/dashboard" : "/stays/new");
}
