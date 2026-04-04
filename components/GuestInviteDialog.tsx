"use client";

import { QRCodeSVG } from "qrcode.react";
import { useEffect, useRef, useState } from "react";

const btnSecondary =
  "border-border text-foreground hover:bg-muted focus-visible:ring-ring inline-flex min-h-11 w-full items-center justify-center rounded-xl border px-4 py-2.5 text-sm font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:min-h-10";

const btnPrimary =
  "bg-primary text-primary-foreground hover:brightness-105 focus-visible:ring-ring inline-flex min-h-11 w-full items-center justify-center rounded-xl px-4 py-2.5 text-sm font-bold transition-[filter] focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:min-h-10 disabled:opacity-50";

const iconBtn =
  "text-muted-foreground hover:text-foreground focus-visible:ring-ring absolute right-3 top-3 inline-flex size-10 items-center justify-center rounded-xl transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  url: string;
};

export function GuestInviteDialog({ open, onOpenChange, url }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [copied, setCopied] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);

  useEffect(() => {
    const d = dialogRef.current;
    if (!d) return;
    const onDialogClose = () => {
      setCopied(false);
      setShareError(null);
      onOpenChange(false);
    };
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

  const copyLink = () => {
    if (!url) return;
    void navigator.clipboard.writeText(url);
    setCopied(true);
    setShareError(null);
    window.setTimeout(() => setCopied(false), 2000);
  };

  const share = async () => {
    setShareError(null);
    if (!url) return;
    if (typeof navigator.share !== "function") {
      copyLink();
      return;
    }
    try {
      await navigator.share({
        title: "Join on Vibin",
        text: "Join the listening party.",
        url,
      });
    } catch (e) {
      const err = e as { name?: string };
      if (err.name !== "AbortError") {
        setShareError("Share didn’t work. Try copy below.");
      }
    }
  };

  const canWebShare =
    typeof navigator !== "undefined" && typeof navigator.share === "function";

  return (
    <dialog
      ref={dialogRef}
      className="border-border bg-background text-foreground fixed left-1/2 top-1/2 z-50 max-h-[min(92dvh,40rem)] w-[min(100vw-1.5rem,22rem)] max-w-[calc(100vw-1.5rem)] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-2xl border p-0 shadow-2xl sm:w-96 [&::backdrop]:bg-black/50 [&::backdrop]:backdrop-blur-[2px]"
      onClick={(e) => {
        if (e.target === dialogRef.current) onOpenChange(false);
      }}
    >
      <div className="relative">
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
          className="flex max-h-[min(92dvh,40rem)] flex-col gap-3 overflow-y-auto px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pl-5 pr-5 pt-[max(3rem,env(safe-area-inset-top))]"
          onClick={(e) => e.stopPropagation()}
        >
          <div>
            <h2
              id="guest-invite-title"
              className="font-display text-foreground pr-10 text-lg font-bold leading-tight"
            >
              Invite guests
            </h2>
            <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
              Scan the code or share the link—without the host key (
              <code className="text-foreground/80 bg-muted rounded px-1 py-0.5 text-[0.65rem]">
                ?h=
              </code>
              ).
            </p>
          </div>

          <div className="flex justify-center">
            <div className="bg-white rounded-2xl p-3 shadow-sm ring-1 ring-black/5">
              {url ? (
                <QRCodeSVG
                  value={url}
                  size={208}
                  level="M"
                  includeMargin={false}
                  marginSize={2}
                  bgColor="#ffffff"
                  fgColor="#111111"
                />
              ) : (
                <div className="text-muted-foreground flex size-[208px] items-center justify-center bg-white text-sm">
                  Preparing…
                </div>
              )}
            </div>
          </div>

          <p className="text-muted-foreground break-all text-center text-[0.7rem] leading-snug">
            {url || "…"}
          </p>

          <div className="flex flex-col gap-2">
            {canWebShare ? (
              <button type="button" className={btnPrimary} onClick={() => void share()}>
                Share link
              </button>
            ) : null}
            <button type="button" className={canWebShare ? btnSecondary : btnPrimary} onClick={copyLink}>
              {copied ? "Copied" : "Copy link"}
            </button>
          </div>

          {shareError ? (
            <p className="text-destructive text-center text-xs" role="alert">
              {shareError}
            </p>
          ) : null}
        </div>
      </div>
    </dialog>
  );
}
