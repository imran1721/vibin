"use client";

import { useEffect, useRef, useState } from "react";

const iconBtn =
  "text-muted-foreground hover:text-foreground focus-visible:ring-ring absolute right-3 top-3 inline-flex size-10 items-center justify-center rounded-xl transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background";

const btnGhost =
  "text-accent hover:brightness-110 focus-visible:ring-ring inline-flex min-h-10 items-center justify-center rounded-lg px-3 py-2 text-xs font-semibold underline underline-offset-4 transition-[filter] focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background";

export type GuestListEntry = {
  userId: string;
  /** Resolved label for UI */
  label: string;
  lastSeenAt: string;
};

function formatActivity(iso: string): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "";
  const diffMs = Date.now() - t;
  if (diffMs < 75_000) return "Active now";
  const m = Math.floor(diffMs / 60_000);
  if (m < 60) return `Seen ${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 48) return `Seen ${h}h ago`;
  return `Seen ${Math.floor(h / 24)}d ago`;
}

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  guests: GuestListEntry[];
  currentUserId: string | null;
  onRefresh: () => void;
  /** When set, host can remove guests from the room */
  isHost?: boolean;
  onKickGuest?: (userId: string) => void | Promise<void>;
  kickBusyUserId?: string | null;
};

const btnKick =
  "text-destructive hover:bg-destructive/10 focus-visible:ring-destructive/40 inline-flex min-h-9 shrink-0 items-center justify-center rounded-lg px-2.5 text-xs font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-45";

export function GuestListDialog({
  open,
  onOpenChange,
  guests,
  currentUserId,
  onRefresh,
  isHost = false,
  onKickGuest,
  kickBusyUserId = null,
}: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [kickConfirmUserId, setKickConfirmUserId] = useState<string | null>(
    null
  );

  useEffect(() => {
    const d = dialogRef.current;
    if (!d) return;
    const onDialogClose = () => onOpenChange(false);
    d.addEventListener("close", onDialogClose);
    return () => d.removeEventListener("close", onDialogClose);
  }, [onOpenChange]);

  useEffect(() => {
    const d = dialogRef.current;
    if (!d) return;
    if (open) {
      if (!d.open) d.showModal();
    } else if (d.open) {
      d.close();
    }
  }, [open]);

  useEffect(() => {
    if (!open) setKickConfirmUserId(null);
  }, [open]);

  useEffect(() => {
    if (
      kickConfirmUserId != null &&
      !guests.some((g) => g.userId === kickConfirmUserId)
    ) {
      setKickConfirmUserId(null);
    }
  }, [guests, kickConfirmUserId]);

  return (
    <dialog
      ref={dialogRef}
      className="border-border bg-background text-foreground fixed left-1/2 top-1/2 z-[115] max-h-[min(88dvh,32rem)] w-[min(100vw-1.5rem,22rem)] max-w-[calc(100vw-1.5rem)] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-2xl border p-0 shadow-2xl sm:w-96 [&::backdrop]:bg-black/50 [&::backdrop]:backdrop-blur-[2px]"
      aria-labelledby="guest-list-title"
      onClick={(e) => {
        if (e.target === dialogRef.current) onOpenChange(false);
      }}
    >
      <div className="relative flex max-h-[min(88dvh,32rem)] flex-col">
        <button
          type="button"
          className={iconBtn}
          onClick={() => onOpenChange(false)}
          aria-label="Close"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="size-5"
            aria-hidden
          >
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>

        <div
          className="flex min-h-0 flex-1 flex-col gap-3 px-5 pb-4 pt-[max(3rem,env(safe-area-inset-top))]"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex shrink-0 items-start justify-between gap-2 pr-8">
            <h2
              id="guest-list-title"
              className="font-display text-foreground text-lg font-bold leading-tight"
            >
              Guests
            </h2>
            <button type="button" className={btnGhost} onClick={() => onRefresh()}>
              Refresh
            </button>
          </div>

          <div className="border-border min-h-0 flex-1 overflow-y-auto overflow-x-hidden rounded-xl border">
            {guests.length === 0 ? (
              <p className="text-muted-foreground p-4 text-sm leading-relaxed">
                No guests in the room yet. Share the invite link so people can
                join.
              </p>
            ) : (
              <ul className="divide-border divide-y" role="list">
                {guests.map((g) => {
                  const isYou = g.userId === currentUserId;
                  const showKick =
                    isHost && onKickGuest && !isYou && kickConfirmUserId !== g.userId;
                  const confirmingKick = kickConfirmUserId === g.userId;
                  return (
                    <li
                      key={g.userId}
                      className="flex flex-col gap-0.5 px-3.5 py-3 sm:px-4"
                    >
                      <div className="flex min-w-0 items-center justify-between gap-2">
                        <div className="flex min-w-0 items-center gap-2">
                          <span className="text-foreground truncate font-semibold">
                            {g.label}
                          </span>
                          {isYou ? (
                            <span className="bg-accent/15 text-accent border-accent/25 shrink-0 rounded-full border px-2 py-0.5 text-[0.6rem] font-bold uppercase tracking-wide">
                              You
                            </span>
                          ) : null}
                        </div>
                        {showKick ? (
                          <button
                            type="button"
                            className={btnKick}
                            onClick={() => setKickConfirmUserId(g.userId)}
                            disabled={kickBusyUserId != null}
                          >
                            Remove
                          </button>
                        ) : null}
                      </div>
                      {confirmingKick ? (
                        <div className="mt-2 flex flex-wrap items-center gap-2 rounded-lg border border-border/70 bg-muted/30 px-2 py-2">
                          <p className="text-foreground min-w-0 flex-1 text-xs leading-snug">
                            Remove{" "}
                            <span className="font-semibold">{g.label}</span>{" "}
                            from the room?
                          </p>
                          <button
                            type="button"
                            className="bg-destructive text-destructive-foreground hover:brightness-105 inline-flex min-h-8 items-center justify-center rounded-lg px-2.5 text-xs font-bold disabled:opacity-45"
                            disabled={kickBusyUserId != null}
                            onClick={() => void onKickGuest?.(g.userId)}
                          >
                            {kickBusyUserId === g.userId ? "Removing…" : "Remove"}
                          </button>
                          <button
                            type="button"
                            className="text-muted-foreground hover:text-foreground inline-flex min-h-8 items-center justify-center rounded-lg px-2 text-xs font-semibold"
                            disabled={kickBusyUserId != null}
                            onClick={() => setKickConfirmUserId(null)}
                          >
                            Cancel
                          </button>
                        </div>
                      ) : null}
                      <span className="text-muted-foreground text-xs">
                        {formatActivity(g.lastSeenAt)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </div>
    </dialog>
  );
}
