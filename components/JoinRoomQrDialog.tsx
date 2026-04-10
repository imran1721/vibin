"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { Html5Qrcode } from "html5-qrcode";
import { extractRoomIdFromScan } from "@/lib/extractRoomIdFromScan";

const iconBtnClass =
  "text-muted-foreground hover:text-foreground focus-visible:ring-ring absolute right-3 top-3 inline-flex size-10 items-center justify-center rounded-xl transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDecoded: (roomId: string) => void;
};

export function JoinRoomQrDialog({ open, onOpenChange, onDecoded }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const onDecodedRef = useRef(onDecoded);
  onDecodedRef.current = onDecoded;

  const reactId = useId().replace(/:/g, "");
  const readerId = `join-room-qr-${reactId}`;

  const [scanError, setScanError] = useState<string | null>(null);

  useEffect(() => {
    const d = dialogRef.current;
    if (!d) return;
    const onClose = () => {
      setScanError(null);
      onOpenChange(false);
    };
    d.addEventListener("close", onClose);
    return () => d.removeEventListener("close", onClose);
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
    if (!open) {
      void (async () => {
        const qr = scannerRef.current;
        if (!qr) return;
        try {
          await qr.stop();
        } catch {
          /* already stopped */
        }
        try {
          qr.clear();
        } catch {
          /* */
        }
        scannerRef.current = null;
      })();
      return;
    }

    setScanError(null);
    let cancelled = false;

    const start = () => {
      void (async () => {
        if (cancelled) return;
        const mount = document.getElementById(readerId);
        if (!mount || cancelled) return;

        const { Html5Qrcode } = await import("html5-qrcode");
        if (cancelled) return;

        const qr = new Html5Qrcode(readerId, { verbose: false });
        scannerRef.current = qr;

        const onSuccess = (text: string) => {
          if (cancelled) return;
          const roomId = extractRoomIdFromScan(text);
          if (!roomId) {
            setScanError("That code isn’t a vibin.click room link.");
            return;
          }
          cancelled = true;
          void qr
            .stop()
            .then(() => {
              try {
                qr.clear();
              } catch {
                /* */
              }
              scannerRef.current = null;
              onDecodedRef.current(roomId);
              onOpenChange(false);
            })
            .catch(() => {
              scannerRef.current = null;
              onDecodedRef.current(roomId);
              onOpenChange(false);
            });
        };

        try {
          await qr.start(
            { facingMode: "environment" },
            { fps: 10, qrbox: { width: 240, height: 240 } },
            onSuccess,
            () => {}
          );
        } catch (e) {
          if (!cancelled) {
            const msg =
              e instanceof Error ? e.message : "Could not start camera";
            setScanError(
              /Permission|NotAllowed|NotFound/i.test(msg)
                ? "Camera access was blocked or no camera was found. Allow camera for this site, or open the invite link the host shared."
                : msg
            );
          }
        }
      })();
    };

    let rafOuter = 0;
    let rafInner = 0;
    rafOuter = requestAnimationFrame(() => {
      rafInner = requestAnimationFrame(start);
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(rafOuter);
      cancelAnimationFrame(rafInner);
      void (async () => {
        const qr = scannerRef.current;
        if (!qr) return;
        try {
          await qr.stop();
        } catch {
          /* */
        }
        try {
          qr.clear();
        } catch {
          /* */
        }
        scannerRef.current = null;
      })();
    };
  }, [open, readerId, onOpenChange]);

  return (
    <dialog
      ref={dialogRef}
      className="border-border bg-background text-foreground fixed left-1/2 top-1/2 z-50 w-[min(100vw-1.5rem,22rem)] max-w-[calc(100vw-1.5rem)] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-2xl border p-0 shadow-2xl sm:w-96 [&::backdrop]:bg-black/50 [&::backdrop]:backdrop-blur-[2px]"
      onClick={(e) => {
        if (e.target === dialogRef.current) onOpenChange(false);
      }}
    >
      <div className="relative">
        <button
          type="button"
          className={iconBtnClass}
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
          className="flex max-h-[min(92dvh,32rem)] flex-col gap-3 overflow-y-auto px-5 pb-5 pt-12"
          onClick={(e) => e.stopPropagation()}
        >
          <div>
            <h2
              id={`${readerId}-title`}
              className="font-display text-foreground pr-8 text-lg font-bold leading-tight"
            >
              Scan room QR
            </h2>
            <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
              Point the camera at the QR from the host’s invite screen. You’ll
              join as a guest.
            </p>
          </div>

          <div
            id={readerId}
            className="bg-muted/30 min-h-[200px] w-full overflow-hidden rounded-xl ring-1 ring-black/10"
          />

          {scanError ? (
            <p className="text-destructive text-center text-xs" role="alert">
              {scanError}
            </p>
          ) : null}
        </div>
      </div>
    </dialog>
  );
}
