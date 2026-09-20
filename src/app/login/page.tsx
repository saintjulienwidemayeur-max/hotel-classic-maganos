import type { Metadata } from "next";
import { PinPad } from "@/components/auth/PinPad";
import { Brand } from "@/components/layout/Brand";
import { translator } from "@/lib/i18n";

export const metadata: Metadata = { title: "Code d\u2019acc\u00e8s" };

/** The sign-in screen is always in French. */
export default function LoginPage() {
  const t = translator("fr");

  return (
    <main className="grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
      {/* Brand panel (desktop only) */}
      <section className="hidden flex-col justify-between bg-ink-900 p-12 lg:flex">
        <Brand tone="light" size="lg" />
        <p className="max-w-sm font-serif text-2xl leading-snug text-ink-100">{t("login.pitch")}</p>
      </section>

      {/* Keypad */}
      <section className="flex items-center justify-center px-6 py-10">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <Brand />
          </div>
          <h1 className="text-center font-serif text-3xl font-semibold tracking-tight">{t("login.title")}</h1>
          <p className="mb-8 mt-2 text-center text-sm text-ink-600">{t("login.subtitle")}</p>
          <PinPad />
        </div>
      </section>
    </main>
  );
}
