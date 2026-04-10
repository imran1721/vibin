"use client";

import { useEffect, useMemo, useRef, useState } from "react";

const iconBtn =
  "text-muted-foreground hover:text-foreground hover:bg-muted/60 focus-visible:ring-ring absolute right-3 top-3 inline-flex size-10 items-center justify-center rounded-xl transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background";

const refreshBtn =
  "text-muted-foreground hover:text-foreground hover:bg-muted/50 focus-visible:ring-ring inline-flex size-9 shrink-0 items-center justify-center rounded-lg transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background";

const removeLink =
  "text-muted-foreground hover:text-destructive focus-visible:ring-ring shrink-0 text-xs font-medium transition-colors focus-visible:rounded focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-40";

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

  const confirmGuest = useMemo(
    () => guests.find((g) => g.userId === kickConfirmUserId) ?? null,
    [guests, kickConfirmUserId]
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
      className="border-border bg-background text-foreground fixed left-1/2 top-1/2 z-[115] max-h-[min(88dvh,34rem)] w-[min(100vw-1.5rem,22rem)] max-w-[calc(100vw-1.5rem)] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-2xl border p-0 shadow-2xl sm:w-96 [&::backdrop]:bg-black/50 [&::backdrop]:backdrop-blur-[2px]"
      aria-labelledby="guest-list-title"
      onClick={(e) => {
        if (e.target === dialogRef.current) onOpenChange(false);
      }}
    >
      <div className="flex max-h-[min(88dvh,34rem)] flex-col">
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
          className="flex min-h-0 flex-1 flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="border-border/80 shrink-0 border-b px-5 pb-3 pt-[max(3rem,env(safe-area-inset-top))] pr-14">
            <div className="flex items-center justify-between gap-3">
              <h2
                id="guest-list-title"
                className="font-display text-foreground text-lg font-bold leading-tight tracking-tight"
              >
                Guests
              </h2>
              <button
                type="button"
                className={refreshBtn}
                onClick={() => onRefresh()}
                title="Refresh list"
                aria-label="Refresh guest list"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  className="size-4"
                  aria-hidden
                >
                  <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                  <path d="M3 3v5h5" />
                  <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
                  <path d="M16 16h5v5" />
                </svg>
              </button>
            </div>
            <p className="text-muted-foreground mt-1 text-[0.7rem] leading-snug sm:text-xs">
              {isHost
                ? "People connected as guests. You can remove someone if needed."
                : "Everyone here is listening with you."}
            </p>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
            {guests.length === 0 ? (
              <p className="text-muted-foreground px-5 py-6 text-sm leading-relaxed">
                No guests in the room yet. Share the invite link so people can
                join.
              </p>
            ) : (
              <ul className="divide-border/80 divide-y" role="list">
                {guests.map((g) => {
                  const isYou = g.userId === currentUserId;
                  const canShowRemove =
                    isHost && onKickGuest && !isYou && kickConfirmUserId == null;
                  const rowMuted =
                    kickConfirmUserId != null &&
                    kickConfirmUserId !== g.userId;

                  return (
                    <li
                      key={g.userId}
                      className={`px-5 py-3.5 transition-opacity ${rowMuted ? "opacity-45" : ""}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                            <span className="text-foreground truncate font-semibold leading-tight">
                              {g.label}
                            </span>
                            {isYou ? (
                              <span className="bg-primary/12 text-primary border-primary/20 shrink-0 rounded-md border px-1.5 py-px text-[0.65rem] font-bold uppercase tracking-wide">
                                You
                              </span>
                            ) : null}
                          </div>
                          <p className="text-muted-foreground mt-1 text-[0.7rem] leading-none sm:text-xs">
                            {formatActivity(g.lastSeenAt)}
                          </p>
                        </div>
                        {canShowRemove ? (
                          <button
                            type="button"
                            className={removeLink}
                            onClick={() => setKickConfirmUserId(g.userId)}
                            disabled={kickBusyUserId != null}
                          >
                            Remove
                          </button>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {kickConfirmUserId != null && confirmGuest ? (
            <div className="border-border/80 bg-muted/35 supports-[backdrop-filter]:bg-muted/25 shrink-0 border-t px-5 py-4 backdrop-blur-sm">
              <p className="text-foreground text-sm leading-snug">
                Remove{" "}
                <span className="font-semibold">{confirmGuest.label}</span> from
                this room? They can rejoin with the invite link.
              </p>
              <div className="mt-3 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3">
                <button
                  type="button"
                  className="border-border text-foreground hover:bg-background/80 focus-visible:ring-ring inline-flex min-h-10 w-full items-center justify-center rounded-xl border px-4 text-sm font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-45 sm:w-auto sm:min-w-[5.5rem]"
                  disabled={kickBusyUserId != null}
                  onClick={() => setKickConfirmUserId(null)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="bg-destructive text-destructive-foreground hover:brightness-105 focus-visible:ring-ring inline-flex min-h-10 w-full items-center justify-center rounded-xl px-4 text-sm font-bold transition-[filter] focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-45 sm:w-auto sm:min-w-[5.5rem]"
                  disabled={kickBusyUserId != null}
                  onClick={() => void onKickGuest?.(kickConfirmUserId)}
                >
                  {kickBusyUserId === kickConfirmUserId
                    ? "Removing…"
                    : "Remove from room"}
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </dialog>
  );
}
