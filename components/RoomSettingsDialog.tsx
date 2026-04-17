"use client";

import { useEffect, useId, useRef, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

const TITLE_MAX = 80;

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  roomId: string;
  hostToken: string;
  initialTitle: string | null;
  initialIsPublic: boolean;
  onSaved: (next: { title: string | null; isPublic: boolean }) => void;
};

export function RoomSettingsDialog({
  open,
  onOpenChange,
  roomId,
  hostToken,
  initialTitle,
  initialIsPublic,
  onSaved,
}: Props) {
  const titleId = useId();
  const descId = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [title, setTitle] = useState(initialTitle ?? "");
  const [isPublic, setIsPublic] = useState(initialIsPublic);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const d = dialogRef.current;
    if (!d) return;
    if (open) {
      setTitle(initialTitle ?? "");
      setIsPublic(initialIsPublic);
      setError(null);
      if (!d.open) d.showModal();
    } else if (d.open) {
      d.close();
    }
  }, [open, initialTitle, initialIsPublic]);

  const trimmed = title.trim();
  const titleValid = trimmed.length > 0 && trimmed.length <= TITLE_MAX;
  const titleChanged = trimmed !== (initialTitle ?? "").trim();
  const visibilityChanged = isPublic !== initialIsPublic;
  const canMakePublic = titleValid;

  const onSave = async () => {
    setBusy(true);
    setError(null);
    try {
      const supabase = getSupabaseBrowserClient();
      const nextTitle = trimmed.length > 0 ? trimmed : null;

      if (titleChanged) {
        // When going private and clearing title, server enforces "title required while public",
        // so the order matters: drop visibility first if needed.
        if (!nextTitle && initialIsPublic) {
          const { error: visErr } = await supabase.rpc("set_room_visibility", {
            p_room_id: roomId,
            p_host_token: hostToken,
            p_is_public: false,
          });
          if (visErr) throw visErr;
        }
        const { error: titleErr } = await supabase.rpc("set_room_title", {
          p_room_id: roomId,
          p_host_token: hostToken,
          p_title: nextTitle,
        });
        if (titleErr) throw titleErr;
      }

      if (visibilityChanged) {
        if (isPublic && !nextTitle) {
          throw new Error("Add a title before making the room public.");
        }
        const { error: visErr } = await supabase.rpc("set_room_visibility", {
          p_room_id: roomId,
          p_host_token: hostToken,
          p_is_public: isPublic,
        });
        if (visErr) throw visErr;
      }

      onSaved({ title: nextTitle, isPublic });
      onOpenChange(false);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Could not save room settings."
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <dialog
      ref={dialogRef}
      className="border-border bg-background text-foreground fixed left-1/2 top-1/2 z-[122] max-h-[min(92dvh,40rem)] w-[min(100vw-1.5rem,24rem)] max-w-[calc(100vw-1.5rem)] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-2xl border p-0 shadow-2xl sm:w-[min(100vw-2rem,28rem)] [&::backdrop]:bg-black/60 [&::backdrop]:backdrop-blur-sm"
      aria-labelledby={titleId}
      aria-describedby={descId}
      onCancel={(e) => {
        e.preventDefault();
        onOpenChange(false);
      }}
      onClick={(e) => {
        if (e.target === dialogRef.current) onOpenChange(false);
      }}
    >
      <div className="flex flex-col gap-4 px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-[max(1.25rem,env(safe-area-inset-top))]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id={titleId} className="font-display text-lg font-bold leading-tight">
              Room settings
            </h2>
            <p id={descId} className="text-muted-foreground mt-1.5 text-sm leading-relaxed">
              Name your room and choose who can find it.
            </p>
          </div>
          <button
            type="button"
            className="text-muted-foreground hover:text-foreground inline-flex size-9 items-center justify-center rounded-lg"
            onClick={() => onOpenChange(false)}
            aria-label="Close room settings"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-4.5" aria-hidden>
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="room-title" className="text-xs font-semibold text-muted-foreground">
            Room title
          </label>
          <input
            id="room-title"
            type="text"
            maxLength={TITLE_MAX}
            placeholder="e.g. Friday night chill"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="border-border bg-card text-foreground placeholder:text-muted-foreground focus-visible:ring-ring min-h-11 w-full rounded-xl border px-3.5 py-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          />
          <p className="text-muted-foreground text-xs">
            Shown on the explore page. Up to {TITLE_MAX} characters.
          </p>
        </div>

        <fieldset className="border-border/70 bg-card/30 flex flex-col gap-2 rounded-xl border p-3">
          <legend className="px-1 text-xs font-semibold text-muted-foreground">Who can join</legend>
          <label className="flex cursor-pointer items-start gap-3 rounded-lg p-2 hover:bg-muted/50">
            <input
              type="radio"
              name="visibility"
              checked={!isPublic}
              onChange={() => setIsPublic(false)}
              className="mt-1"
            />
            <div className="flex-1">
              <p className="text-sm font-semibold">Private</p>
              <p className="text-muted-foreground text-xs leading-snug">
                Only people with the link or QR code can join.
              </p>
            </div>
          </label>
          <label
            className={`flex items-start gap-3 rounded-lg p-2 ${canMakePublic ? "cursor-pointer hover:bg-muted/50" : "cursor-not-allowed opacity-60"}`}
          >
            <input
              type="radio"
              name="visibility"
              checked={isPublic}
              disabled={!canMakePublic}
              onChange={() => setIsPublic(true)}
              className="mt-1"
            />
            <div className="flex-1">
              <p className="text-sm font-semibold">Public</p>
              <p className="text-muted-foreground text-xs leading-snug">
                Listed on the explore page so anyone can find and join.
                {canMakePublic ? null : " Add a title above to enable."}
              </p>
            </div>
          </label>
        </fieldset>

        {error ? (
          <div
            className="border-destructive/35 bg-destructive/10 rounded-xl border px-3 py-2"
            role="alert"
          >
            <p className="text-destructive text-xs font-medium">{error}</p>
          </div>
        ) : null}

        <button
          type="button"
          onClick={() => void onSave()}
          disabled={busy || (!titleChanged && !visibilityChanged)}
          className="bg-primary text-primary-foreground hover:brightness-105 focus-visible:ring-ring inline-flex min-h-11 w-full items-center justify-center rounded-xl px-4 py-2 text-sm font-bold transition-[filter] focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-55"
        >
          {busy ? "Saving…" : "Save changes"}
        </button>
      </div>
    </dialog>
  );
}
