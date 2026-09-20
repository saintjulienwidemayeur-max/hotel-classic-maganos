import Link from "next/link";
import { translator } from "@/lib/i18n";

export default function NotFound() {
  const t = translator("fr");

  return (
    <div className="panel mx-auto max-w-md p-8 text-center">
      <h1 className="font-serif text-2xl font-semibold">{t("err.notFoundTitle")}</h1>
      <p className="mt-2 text-sm text-ink-600">{t("err.notFoundBody")}</p>
      <Link href="/stays" className="btn-primary mt-6">
        {t("nav.stays")}
      </Link>
    </div>
  );
}
