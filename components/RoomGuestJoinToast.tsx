"use client";

import { useEffect } from "react";

type Props = {
  message: string | null;
  onDismiss: () => void;
  /** Stack a second toast below the default join toast. */
  variant?: "default" | "stacked" | "stacked2";
};

export function RoomGuestJoinToast({
  message,
  onDismiss,
  variant = "default",
}: Props) {
  useEffect(() => {
    if (!message) return;
    const id = window.setTimeout(onDismiss, 4200);
    return () => window.clearTimeout(id);
  }, [message, onDismiss]);

  if (!message) return null;

  const topClass =
    variant === "stacked"
      ? "top-[max(7.8rem,env(safe-area-inset-top)+6.3rem)]"
      : variant === "stacked2"
        ? "top-[max(9.6rem,env(safe-area-inset-top)+8.1rem)]"
      : "top-[max(6.1rem,env(safe-area-inset-top)+4.6rem)]";

  return (
    <div
      role="status"
      aria-live="polite"
      className={`border-accent/35 bg-card/95 text-foreground supports-[backdrop-filter]:bg-card/90 fixed left-1/2 z-[60] w-[min(100vw-2rem,18rem)] -translate-x-1/2 rounded-xl border px-3 py-2 text-center text-xs font-semibold shadow-lg shadow-black/15 backdrop-blur-md motion-reduce:transition-none ${topClass}`}
    >
      <button
        type="button"
        onClick={onDismiss}
        className="text-muted-foreground hover:text-foreground absolute right-1.5 top-1.5 inline-flex size-5 items-center justify-center rounded-md transition-colors"
        aria-label="Dismiss toast"
        title="Dismiss"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-3.5" aria-hidden>
          <path d="M18 6 6 18M6 6l12 12" />
        </svg>
      </button>
      <span className="block pr-4">{message}</span>
    </div>
  );
}
