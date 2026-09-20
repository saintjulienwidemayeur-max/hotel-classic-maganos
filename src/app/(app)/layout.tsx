import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getLang } from "@/lib/lang";
import { BottomNav } from "@/components/layout/NavLinks";
import { IdleLock } from "@/components/layout/IdleLock";
import { MobileHeader } from "@/components/layout/MobileHeader";
import { NoAccess } from "@/components/layout/NoAccess";
import { Sidebar } from "@/components/layout/Sidebar";

/** Minutes of inactivity before an administrator session locks itself (ADMIN_IDLE_MINUTES, 0 = never). */
function adminIdleMinutes(): number {
  const raw = process.env.ADMIN_IDLE_MINUTES;
  const value = raw === undefined || raw.trim() === "" ? 10 : Number(raw);
  return Number.isFinite(value) && value >= 0 ? value : 10;
}

/**
 * Shell for every signed-in screen: sidebar on desktop, top bar + bottom tabs on mobile.
 * The middleware already redirects signed-out visitors; this check is a second gate.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { profile, signedIn } = await getSession();

  if (!signedIn) redirect("/login");
  if (!profile) return <NoAccess />;

  const isAdmin = profile.role === "admin";
  const lang = await getLang(); // reception is always French

  return (
    <div className="min-h-screen lg:pl-64">
      <Sidebar profile={profile} lang={lang} />
      <MobileHeader profile={profile} lang={lang} />
      <main className="mx-auto w-full max-w-6xl px-4 pb-28 pt-6 sm:px-6 lg:px-8 lg:pb-12 lg:pt-10">{children}</main>
      <BottomNav isAdmin={isAdmin} lang={lang} />
      {isAdmin ? <IdleLock minutes={adminIdleMinutes()} /> : null}
    </div>
  );
}
