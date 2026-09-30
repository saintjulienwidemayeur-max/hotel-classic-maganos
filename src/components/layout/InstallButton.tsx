"use client";

import { useEffect, useState } from "react";
import { translator, type Lang } from "@/lib/i18n";

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

/**
 * "Install the app" button. Appears only when the browser says the app can be
 * installed (Chrome, Edge, Android). On iPhone/iPad, where there is no prompt,
 * it explains the Share -> Add to Home Screen steps instead.
 */
export function InstallButton({ lang = "fr", className = "btn-secondary btn-sm" }: { lang?: Lang; className?: string }) {
  const t = translator(lang);
  const [promptEvent, setPromptEvent] = useState<InstallPromptEvent | null>(null);
  const [isIos, setIsIos] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;
    setInstalled(standalone);
    setIsIos(/iphone|ipad|ipod/i.test(navigator.userAgent) && !standalone);

    const onPrompt = (event: Event) => {
      event.preventDefault();
      setPromptEvent(event as InstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setPromptEvent(null);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (installed) return null;
  if (!promptEvent && !isIos) return null;

  return (
    <div>
      <button
        type="button"
        className={className}
        onClick={async () => {
          if (promptEvent) {
            await promptEvent.prompt();
            await promptEvent.userChoice;
            setPromptEvent(null);
          } else {
            setShowHelp((open) => !open);
          }
        }}
      >
        {t("pwa.install")}
      </button>
      {showHelp ? <p className="mt-2 max-w-xs text-xs text-ink-600">{t("pwa.iosHelp")}</p> : null}
    </div>
  );
}
