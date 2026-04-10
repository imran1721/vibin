"use client";

import {
  startTransition,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { APP_TAGLINE } from "@/components/AppBrandLockup";
import { VibinEqualizerMark } from "@/components/VibinEqualizerMark";

const STORAGE_KEY = "vibin_splash_dismissed_session";

type Props = {
  children: ReactNode;
};

/**
 * Full-screen launch splash — once per browser tab session; respects reduced motion.
 */
export function SplashScreen({ children }: Props) {
  const [visible, setVisible] = useState(true);
  const [exiting, setExiting] = useState(false);
  const timersRef = useRef<number[]>([]);

  useLayoutEffect(() => {
    try {
      if (sessionStorage.getItem(STORAGE_KEY) === "1") {
        startTransition(() => {
          setVisible(false);
        });
        return;
      }
    } catch {
      /* private mode */
    }

    const prefersReduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const minShowMs = prefersReduced ? 380 : 1050;
    const fadeMs = prefersReduced ? 180 : 420;
    const start = Date.now();

    const clearTimers = () => {
      timersRef.current.forEach(clearTimeout);
      timersRef.current = [];
    };

    const runExit = () => {
      setExiting(true);
      const t2 = window.setTimeout(() => {
        setVisible(false);
        try {
          sessionStorage.setItem(STORAGE_KEY, "1");
        } catch {
          /* */
        }
      }, fadeMs);
      timersRef.current.push(t2);
    };

    const scheduleExit = () => {
      const elapsed = Date.now() - start;
      const wait = Math.max(0, minShowMs - elapsed);
      const t1 = window.setTimeout(() => {
        runExit();
      }, wait);
      timersRef.current.push(t1);
    };

    if (typeof document !== "undefined" && document.fonts?.ready) {
      void document.fonts.ready.then(scheduleExit);
    } else {
      scheduleExit();
    }

    return clearTimers;
  }, []);

  return (
    <>
      {children}
      {visible ? (
        <div
          className={`vibin-splash-layer pointer-events-auto fixed inset-0 z-[100] flex flex-col items-center justify-center overflow-hidden transition-[opacity,transform] duration-[420ms] ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:duration-200 motion-safe:will-change-[opacity,transform] ${exiting
              ? "pointer-events-none opacity-0 motion-safe:scale-[0.985] motion-reduce:opacity-0"
              : "opacity-100 motion-safe:scale-100"
            }`}
          aria-hidden
        >
          <div className="vibin-splash-bg vibin-page-bg absolute inset-0" />
          <div
            className="pointer-events-none absolute inset-0 overflow-hidden"
            aria-hidden
          >
            <div className="vibin-splash-orb-a absolute -left-[18%] top-[12%] h-[min(52vmin,420px)] w-[min(52vmin,420px)] rounded-full bg-primary/18 blur-3xl" />
            <div className="vibin-splash-orb-b absolute -right-[12%] bottom-[18%] h-[min(44vmin,360px)] w-[min(44vmin,360px)] rounded-full bg-accent/22 blur-3xl" />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_90%_60%_at_50%_0%,color-mix(in_oklch,var(--foreground)_6%,transparent),transparent_55%)] opacity-80 dark:opacity-100" />
          </div>

          <div className="relative z-[1] flex flex-col items-center gap-6 px-6 text-center sm:gap-8">
            <div className="vibin-splash-mark-wrap relative">
              <div className="absolute inset-0 -m-6 rounded-[2rem] bg-gradient-to-br from-primary/25 via-transparent to-accent/20 opacity-80 blur-2xl motion-reduce:opacity-40" />
              <VibinEqualizerMark className="relative size-[4.25rem] shadow-[0_20px_50px_-12px_rgba(0,0,0,0.35)] sm:size-[5.25rem] dark:shadow-[0_24px_60px_-8px_rgba(0,0,0,0.55)]" />
            </div>
            <div className="space-y-2">
              <p className="font-display text-accent text-[1.65rem] font-extrabold tracking-tight sm:text-4xl">
                vibin.click
              </p>
              <p className="text-muted-foreground max-w-[16rem] text-sm font-medium leading-snug sm:text-base">
                {APP_TAGLINE}
              </p>
            </div>
          </div>

          <div
            className="absolute bottom-0 left-0 right-0 h-[3px] overflow-hidden bg-muted/30 motion-reduce:hidden"
            aria-hidden
          >
            <div className="vibin-splash-progress h-full w-full origin-left bg-gradient-to-r from-primary/50 via-accent/80 to-primary/50" />
          </div>
        </div>
      ) : null}
    </>
  );
}
