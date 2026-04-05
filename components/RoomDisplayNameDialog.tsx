"use client";

import { useEffect, useId, useRef, useState } from "react";
import {
  saveDisplayProfileAnonymous,
  saveDisplayProfileNamed,
} from "@/lib/displayName";

/** Shared: same min-height + fill grid row so both buttons match when one line-wraps. */
const btnBase =
  "inline-flex w-full min-h-[3.25rem] items-center justify-center rounded-xl px-3 py-2.5 text-center text-sm leading-snug transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:min-h-[3.5rem] sm:px-4 h-full";

const btnSecondary = `${btnBase} border-border text-foreground hover:bg-muted focus-visible:ring-ring border font-semibold order-2 sm:order-1`;

const btnPrimary = `${btnBase} bg-primary text-primary-foreground hover:brightness-105 focus-visible:ring-ring font-bold transition-[filter] order-1 sm:order-2 disabled:opacity-45`;

type Props = {
  open: boolean;
  isHost: boolean;
  onComplete: () => void;
};

export function RoomDisplayNameDialog({ open, isHost, onComplete }: Props) {
  const titleId = useId();
  const descId = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("");

  useEffect(() => {
    const d = dialogRef.current;
    if (!d) return;
    if (open) {
      if (!d.open) d.showModal();
      requestAnimationFrame(() => inputRef.current?.focus());
    } else if (d.open) {
      d.close();
    }
  }, [open]);

  const finishAnonymous = () => {
    saveDisplayProfileAnonymous();
    setName("");
    onComplete();
  };

  const finishNamed = () => {
    const t = name.trim();
    if (t.length === 0) {
      finishAnonymous();
      return;
    }
    saveDisplayProfileNamed(t);
    setName("");
    onComplete();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      finishNamed();
    }
  };

  return (
    <dialog
      ref={dialogRef}
      className="border-border bg-background text-foreground fixed left-1/2 top-1/2 z-[120] max-h-[min(92dvh,40rem)] w-[min(100vw-1.5rem,22rem)] max-w-[calc(100vw-1.5rem)] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-2xl border p-0 shadow-2xl sm:w-[min(100vw-2rem,26rem)] [&::backdrop]:bg-black/60 [&::backdrop]:backdrop-blur-sm"
      aria-labelledby={titleId}
      aria-describedby={descId}
      onKeyDown={onKeyDown}
      onCancel={(e) => {
        e.preventDefault();
        finishAnonymous();
      }}
    >
      <div
        className="flex flex-col gap-4 px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-[max(1.25rem,env(safe-area-inset-top))]"
        onClick={(e) => e.stopPropagation()}
      >
        <div>
          <h2
            id={titleId}
            className="font-display text-foreground text-lg font-bold leading-tight"
          >
            {isHost ? "Host this session" : "Join the room"}
          </h2>
          <p
            id={descId}
            className="text-muted-foreground mt-2 text-sm leading-relaxed"
          >
            Add a name so others see who queued a song or changed the track. Or
            stay anonymous—one tap.
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="room-display-name" className="sr-only">
            Display name (optional)
          </label>
          <input
            ref={inputRef}
            id="room-display-name"
            type="text"
            autoComplete="nickname"
            maxLength={40}
            placeholder="Your name (optional)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="border-border bg-card text-foreground placeholder:text-muted-foreground focus-visible:ring-ring min-h-11 w-full rounded-xl border px-3.5 py-2.5 text-sm outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          />
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 sm:items-stretch">
          <button
            type="button"
            className={btnPrimary}
            onClick={() => finishNamed()}
          >
            {name.trim() ? "Use this name" : "Continue"}
          </button>
          <button
            type="button"
            className={btnSecondary}
            onClick={() => finishAnonymous()}
          >
            Stay anonymous
          </button>
        </div>
      </div>
    </dialog>
  );
}
