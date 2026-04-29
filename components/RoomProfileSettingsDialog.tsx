"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import {
  createQuirkyAlias,
  getDisplayAvatarDataUrl,
  getQueueAttributionLabel,
  saveDisplayAvatarDataUrl,
  saveDisplayProfileNamed,
} from "@/lib/displayName";
import { useTheme } from "@/components/ThemeProvider";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

const TITLE_MAX = 80;

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
  isHost?: boolean;
  roomId?: string;
  hostToken?: string;
  roomTitle?: string | null;
  roomIsPublic?: boolean;
  onRoomSettingsSaved?: (next: { title: string | null; isPublic: boolean }) => void;
};

async function resizeImageToDataUrl(file: File): Promise<string> {
  const src = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("Could not read image"));
      img.src = src;
    });

    const maxSide = 256;
    const scale = Math.min(1, maxSide / Math.max(image.width, image.height));
    const width = Math.max(1, Math.round(image.width * scale));
    const height = Math.max(1, Math.round(image.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas unavailable");
    ctx.drawImage(image, 0, 0, width, height);
    return canvas.toDataURL("image/jpeg", 0.84);
  } finally {
    URL.revokeObjectURL(src);
  }
}

export function RoomProfileSettingsDialog({
  open,
  onOpenChange,
  onSaved,
  isHost = false,
  roomId,
  hostToken,
  roomTitle: initialRoomTitle,
  roomIsPublic: initialRoomIsPublic,
  onRoomSettingsSaved,
}: Props) {
  const titleId = useId();
  const descId = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [name, setName] = useState("");
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const { resolved: themeResolved, setChoice: setThemeChoice } = useTheme();
  const [roomTitleDraft, setRoomTitleDraft] = useState(initialRoomTitle ?? "");
  const [roomPublicDraft, setRoomPublicDraft] = useState(initialRoomIsPublic ?? false);
  const [roomSaveBusy, setRoomSaveBusy] = useState(false);
  const [roomSaveError, setRoomSaveError] = useState<string | null>(null);

  useEffect(() => {
    const d = dialogRef.current;
    if (!d) return;
    if (open) {
      const currentName = getQueueAttributionLabel() ?? "";
      setName(currentName);
      setPhotoDataUrl(getDisplayAvatarDataUrl());
      setRoomTitleDraft(initialRoomTitle ?? "");
      setRoomPublicDraft(initialRoomIsPublic ?? false);
      setRoomSaveError(null);
      if (!d.open) d.showModal();
    } else if (d.open) {
      d.close();
    }
  }, [open]);

  const initialBadge = useMemo(() => {
    const t = name.trim();
    return t.length > 0 ? t[0]!.toUpperCase() : "♪";
  }, [name]);

  const onSave = async () => {
    const nextName = name.trim() || createQuirkyAlias();
    saveDisplayProfileNamed(nextName);
    saveDisplayAvatarDataUrl(photoDataUrl);

    if (isHost && roomId && hostToken) {
      const trimmedTitle = roomTitleDraft.trim();
      const nextTitle = trimmedTitle.length > 0 ? trimmedTitle : null;
      const titleChanged = nextTitle !== (initialRoomTitle ?? null);
      const visChanged = roomPublicDraft !== (initialRoomIsPublic ?? false);

      if (titleChanged || visChanged) {
        setRoomSaveBusy(true);
        setRoomSaveError(null);
        try {
          const supabase = getSupabaseBrowserClient();
          if (titleChanged) {
            if (!nextTitle && (initialRoomIsPublic ?? false)) {
              const { error } = await supabase.rpc("set_room_visibility", {
                p_room_id: roomId,
                p_host_token: hostToken,
                p_is_public: false,
              });
              if (error) throw error;
            }
            const { error } = await supabase.rpc("set_room_title", {
              p_room_id: roomId,
              p_host_token: hostToken,
              p_title: nextTitle,
            });
            if (error) throw error;
          }
          if (visChanged) {
            if (roomPublicDraft && !nextTitle)
              throw new Error("Add a title before making the room public.");
            const { error } = await supabase.rpc("set_room_visibility", {
              p_room_id: roomId,
              p_host_token: hostToken,
              p_is_public: roomPublicDraft,
            });
            if (error) throw error;
          }
          onRoomSettingsSaved?.({ title: nextTitle, isPublic: roomPublicDraft });
        } catch (e) {
          setRoomSaveError(
            e instanceof Error ? e.message : "Could not save room settings."
          );
          setRoomSaveBusy(false);
          return;
        } finally {
          setRoomSaveBusy(false);
        }
      }
    }

    onOpenChange(false);
    onSaved();
  };

  return (
    <dialog
      ref={dialogRef}
      className="border-border bg-background text-foreground fixed left-1/2 top-1/2 z-[122] max-h-[min(92dvh,40rem)] w-[min(100vw-1.5rem,23rem)] max-w-[calc(100vw-1.5rem)] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-2xl border p-0 shadow-2xl sm:w-[min(100vw-2rem,27rem)] [&::backdrop]:bg-black/60 [&::backdrop]:backdrop-blur-sm"
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
      <div className="flex max-h-[min(85dvh,38rem)] flex-col">
        <div className="flex shrink-0 items-start justify-between gap-3 px-5 pt-[max(1.25rem,env(safe-area-inset-top))] pb-3">
          <div>
            <h2 id={titleId} className="font-display text-lg font-bold leading-tight">
              Settings
            </h2>
            <p id={descId} className="text-muted-foreground mt-1.5 text-sm leading-relaxed">
              {isHost ? "Room and profile settings." : "Update your name and photo for this device."}
            </p>
          </div>
          <button
            type="button"
            className="text-muted-foreground hover:text-foreground inline-flex size-9 items-center justify-center rounded-lg"
            onClick={() => onOpenChange(false)}
            aria-label="Close settings"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-4.5" aria-hidden>
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5"
        >

        {isHost ? (
          <>
            <div className="flex flex-col gap-2">
              <label htmlFor="room-title" className="text-xs font-semibold text-muted-foreground">
                Room title
              </label>
              <input
                id="room-title"
                type="text"
                maxLength={TITLE_MAX}
                placeholder="e.g. Friday night chill"
                value={roomTitleDraft}
                onChange={(e) => setRoomTitleDraft(e.target.value)}
                className="border-border bg-card text-foreground placeholder:text-muted-foreground focus-visible:ring-ring min-h-11 w-full rounded-xl border px-3.5 py-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              />
            </div>

            <fieldset className="border-border/70 bg-card/30 flex flex-col gap-2 rounded-xl border p-3">
              <legend className="px-1 text-xs font-semibold text-muted-foreground">Who can join</legend>
              <label className="flex cursor-pointer items-start gap-3 rounded-lg p-2 hover:bg-muted/50">
                <input
                  type="radio"
                  name="visibility"
                  checked={!roomPublicDraft}
                  onChange={() => setRoomPublicDraft(false)}
                  className="mt-1"
                />
                <div className="flex-1">
                  <p className="text-sm font-semibold">Private</p>
                  <p className="text-muted-foreground text-xs leading-snug">Only people with the link or QR code can join.</p>
                </div>
              </label>
              <label
                className={`flex items-start gap-3 rounded-lg p-2 ${roomTitleDraft.trim().length > 0 ? "cursor-pointer hover:bg-muted/50" : "cursor-not-allowed opacity-60"}`}
              >
                <input
                  type="radio"
                  name="visibility"
                  checked={roomPublicDraft}
                  disabled={roomTitleDraft.trim().length === 0}
                  onChange={() => setRoomPublicDraft(true)}
                  className="mt-1"
                />
                <div className="flex-1">
                  <p className="text-sm font-semibold">Public</p>
                  <p className="text-muted-foreground text-xs leading-snug">
                    Listed on the explore page so anyone can find and join.
                    {roomTitleDraft.trim().length > 0 ? null : " Add a title above to enable."}
                  </p>
                </div>
              </label>
            </fieldset>

            {roomSaveError ? (
              <div className="border-destructive/35 bg-destructive/10 rounded-xl border px-3 py-2" role="alert">
                <p className="text-destructive text-xs font-medium">{roomSaveError}</p>
              </div>
            ) : null}

            <div className="bg-border/50 h-px" />
          </>
        ) : null}

        <div className="flex items-center gap-3">
          <div className="border-border bg-muted relative inline-flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-full border">
            {photoDataUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photoDataUrl} alt="Profile" className="size-full object-cover" />
            ) : (
              <span className="text-sm font-bold">{initialBadge}</span>
            )}
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <label className="text-xs font-semibold text-muted-foreground">Photo</label>
            <input
              type="file"
              accept="image/*"
              disabled={photoBusy}
              onChange={(e) => {
                const file = e.currentTarget.files?.[0];
                if (!file) return;
                setPhotoBusy(true);
                void resizeImageToDataUrl(file)
                  .then((dataUrl) => setPhotoDataUrl(dataUrl))
                  .finally(() => setPhotoBusy(false));
              }}
              className="text-xs text-muted-foreground"
            />
            {photoDataUrl ? (
              <button
                type="button"
                onClick={() => setPhotoDataUrl(null)}
                className="text-xs font-semibold text-primary underline underline-offset-4"
              >
                Remove photo
              </button>
            ) : null}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="profile-name" className="text-xs font-semibold text-muted-foreground">
            Display name
          </label>
          <input
            id="profile-name"
            type="text"
            autoComplete="nickname"
            maxLength={40}
            placeholder="Your name (optional)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="border-border bg-card text-foreground placeholder:text-muted-foreground focus-visible:ring-ring min-h-11 w-full rounded-xl border px-3.5 py-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          />
          <p className="text-muted-foreground text-xs">
            Leave blank and we will generate a quirky alias.
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-xs font-semibold text-muted-foreground">
            Theme
          </span>
          <div className="border-border bg-muted/30 inline-flex w-full rounded-xl border p-1">
            <button
              type="button"
              onClick={() => setThemeChoice("light")}
              aria-pressed={themeResolved === "light"}
              className={`focus-visible:ring-ring inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
                themeResolved === "light"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="size-4"
                aria-hidden
              >
                <circle cx="12" cy="12" r="4" />
                <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4" />
              </svg>
              Light
            </button>
            <button
              type="button"
              onClick={() => setThemeChoice("dark")}
              aria-pressed={themeResolved === "dark"}
              className={`focus-visible:ring-ring inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
                themeResolved === "dark"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="size-4"
                aria-hidden
              >
                <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
              </svg>
              Dark
            </button>
          </div>
        </div>

        </div>

        <div className="shrink-0 px-5 pt-3 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
          <button
            type="button"
            onClick={() => void onSave()}
            disabled={roomSaveBusy}
            className="bg-primary text-primary-foreground hover:brightness-105 focus-visible:ring-ring inline-flex min-h-11 w-full items-center justify-center rounded-xl px-4 py-2 text-sm font-bold transition-[filter] focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-55"
          >
            {roomSaveBusy ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>
    </dialog>
  );
}
