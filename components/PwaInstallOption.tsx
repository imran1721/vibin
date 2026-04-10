"use client";

import { useCallback, useEffect, useState } from "react";

function isIosDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  if (/iPad|iPhone|iPod/.test(ua)) return true;
  return (
    navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1
  );
}

function isStandaloneDisplay(): boolean {
  if (typeof window === "undefined") return false;
  if (window.matchMedia("(display-mode: standalone)").matches) return true;
  return (
    (window.navigator as Navigator & { standalone?: boolean }).standalone ===
    true
  );
}

function isLikelyChromium(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Chrome|Chromium|Edg\//.test(navigator.userAgent);
}

const cardClass =
  "border-border/70 bg-card/65 flex flex-col gap-3 rounded-2xl border px-4 py-4 shadow-sm sm:px-5 sm:py-5";

const btnClass =
  "bg-primary text-primary-foreground focus-visible:ring-ring hover:brightness-105 active:brightness-95 inline-flex min-h-11 w-full items-center justify-center rounded-xl px-4 py-2.5 text-sm font-bold transition-[filter] focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50";

export function PwaInstallOption() {
  const [standalone, setStandalone] = useState(false);
  const [ios, setIos] = useState(false);
  const [chromium, setChromium] = useState(false);
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(
    null
  );
  const [installBusy, setInstallBusy] = useState(false);
  const [installOutcome, setInstallOutcome] = useState<string | null>(null);

  useEffect(() => {
    setStandalone(isStandaloneDisplay());
    setIos(isIosDevice());
    setChromium(isLikelyChromium());
  }, []);

  useEffect(() => {
    const onBip = (e: BeforeInstallPromptEvent) => {
      e.preventDefault();
      setDeferred(e);
    };
    window.addEventListener("beforeinstallprompt", onBip);
    return () => window.removeEventListener("beforeinstallprompt", onBip);
  }, []);

  const runInstall = useCallback(async () => {
    if (!deferred) return;
    setInstallBusy(true);
    setInstallOutcome(null);
    try {
      await deferred.prompt();
      const { outcome } = await deferred.userChoice;
      setInstallOutcome(
        outcome === "accepted"
          ? "Installed — open vibin.click from your home screen or app list."
          : "Install dismissed — you can try again from the browser menu."
      );
      setDeferred(null);
    } catch {
      setInstallOutcome("Could not show the install dialog.");
    } finally {
      setInstallBusy(false);
    }
  }, [deferred]);

  if (standalone) {
    return (
      <div className={cardClass}>
        <p className="text-foreground text-sm font-semibold">App</p>
        <p className="text-muted-foreground text-sm leading-relaxed">
          You&apos;re using vibin.click as an installed app. Full screen and quick
          launch from your home screen.
        </p>
      </div>
    );
  }

  return (
    <div className={cardClass}>
      <p className="text-foreground text-sm font-semibold">Install as app</p>
      <p className="text-muted-foreground -mt-1 text-sm leading-relaxed">
        Add vibin.click to your home screen for a full-screen experience and faster
        access. Works best after the site has loaded once in production.
      </p>

      {deferred ? (
        <button
          type="button"
          className={btnClass}
          disabled={installBusy}
          onClick={() => void runInstall()}
        >
          {installBusy ? "Installing…" : "Install vibin.click"}
        </button>
      ) : null}

      {installOutcome ? (
        <p className="text-muted-foreground text-sm leading-relaxed">
          {installOutcome}
        </p>
      ) : null}

      {ios ? (
        <ol className="text-muted-foreground list-decimal space-y-1.5 pl-4 text-sm leading-relaxed">
          <li>Tap the Share button (square with arrow) in Safari.</li>
          <li>
            Scroll and tap <strong className="text-foreground">Add to Home Screen</strong>.
          </li>
          <li>Confirm — vibin.click opens like a native app.</li>
        </ol>
      ) : !deferred ? (
        <p className="text-muted-foreground text-sm leading-relaxed">
          {chromium
            ? "If you don’t see an Install button, open the browser menu (⋮) and choose Install app or add to home screen when it appears."
            : "Use your browser’s menu to install or add this site to your home screen."}
        </p>
      ) : null}
    </div>
  );
}
