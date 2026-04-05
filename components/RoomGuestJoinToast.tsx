"use client";

import { useEffect } from "react";

type Props = {
  message: string | null;
  onDismiss: () => void;
};

export function RoomGuestJoinToast({ message, onDismiss }: Props) {
  useEffect(() => {
    if (!message) return;
    const id = window.setTimeout(onDismiss, 4200);
    return () => window.clearTimeout(id);
  }, [message, onDismiss]);

  if (!message) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="border-primary/30 bg-card/95 text-foreground supports-[backdrop-filter]:bg-card/90 fixed left-1/2 top-[max(4.5rem,env(safe-area-inset-top)+3rem)] z-[60] w-[min(100vw-2rem,20rem)] -translate-x-1/2 rounded-2xl border px-4 py-3 text-center text-sm font-semibold shadow-lg shadow-black/15 backdrop-blur-md motion-reduce:transition-none"
    >
      {message}
    </div>
  );
}
