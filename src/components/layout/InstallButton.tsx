"use client";

import { useEffect, useState } from "react";
import { translator, type Lang } from "@/lib/i18n";

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

/**
 * "Install the app" button. Uses the browser's install prompt when it is available
 * (Chrome, Edge, Android). Otherwise (iPhone/iPad, or the browser has not offered the
 * prompt) it explains how to install from the browser menu instead.
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

    const saved = (window as Window & { __pwaPrompt?: Event }).__pwaPrompt;
    if (saved) setPromptEvent(saved as InstallPromptEvent);

    // The root layout stores the browser's one-time prompt on window so it survives page changes.
    const onPrompt = () => {
      const event = (window as Window & { __pwaPrompt?: Event }).__pwaPrompt;
      if (event) setPromptEvent(event as InstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setPromptEvent(null);
    };
    window.addEventListener("pwa-prompt-ready", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("pwa-prompt-ready", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (installed) return null;

  return (
    <div>
      <button
        type="button"
        className={className}
        onClick={async () => {
          if (promptEvent) {
            await promptEvent.prompt();
            await promptEvent.userChoice;
            (window as Window & { __pwaPrompt?: Event }).__pwaPrompt = undefined;
            setPromptEvent(null);
          } else {
            setShowHelp((open) => !open);
          }
        }}
      >
        {t("pwa.install")}
      </button>
      {showHelp ? <p className="mt-2 max-w-xs text-xs text-ink-600">{isIos ? t("pwa.iosHelp") : t("pwa.manualHelp")}</p> : null}
    </div>
  );
}
