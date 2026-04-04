"use client";

import { useEffect, useRef } from "react";

const btnSecondary =
  "border-border text-foreground hover:bg-muted focus-visible:ring-ring inline-flex min-h-11 w-full flex-1 items-center justify-center rounded-xl border px-4 py-2.5 text-sm font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:min-h-10";

const btnPrimary =
  "bg-primary text-primary-foreground hover:brightness-105 focus-visible:ring-ring inline-flex min-h-11 w-full flex-1 items-center justify-center rounded-xl px-4 py-2.5 text-sm font-bold transition-[filter] focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:min-h-10 disabled:opacity-50";

const btnDanger =
  "bg-destructive text-destructive-foreground hover:brightness-105 focus-visible:ring-ring inline-flex min-h-11 w-full flex-1 items-center justify-center rounded-xl px-4 py-2.5 text-sm font-bold transition-[filter] focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:min-h-10 disabled:opacity-50";

const iconBtn =
  "text-muted-foreground hover:text-foreground focus-visible:ring-ring absolute right-3 top-3 inline-flex size-10 items-center justify-center rounded-xl transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel?: string;
  onConfirm: () => void | Promise<void>;
  busy?: boolean;
  destructive?: boolean;
};

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel = "Cancel",
  onConfirm,
  busy,
  destructive,
}: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);

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

  const runConfirm = () => {
    void Promise.resolve(onConfirm()).catch(() => {
      /* parent handles errors */
    });
  };

  const confirmBtnClass = destructive ? btnDanger : btnPrimary;

  return (
    <dialog
      ref={dialogRef}
      className="border-border bg-background text-foreground fixed left-1/2 top-1/2 z-[110] max-h-[min(92dvh,40rem)] w-[min(100vw-1.5rem,22rem)] max-w-[calc(100vw-1.5rem)] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-2xl border p-0 shadow-2xl sm:w-96 [&::backdrop]:bg-black/50 [&::backdrop]:backdrop-blur-[2px]"
      onClick={(e) => {
        if (!busy && e.target === dialogRef.current) onOpenChange(false);
      }}
      aria-labelledby="confirm-dialog-title"
    >
      <div className="relative">
        <button
          type="button"
          className={iconBtn}
          disabled={busy}
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
          className="flex flex-col gap-5 px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-[max(3rem,env(safe-area-inset-top))]"
          onClick={(e) => e.stopPropagation()}
        >
          <div>
            <h2
              id="confirm-dialog-title"
              className="font-display text-foreground pr-10 text-lg font-bold leading-tight"
            >
              {title}
            </h2>
            <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
              {description}
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:flex-row-reverse">
            <button
              type="button"
              className={confirmBtnClass}
              disabled={busy}
              onClick={() => runConfirm()}
            >
              {busy ? "Please wait…" : confirmLabel}
            </button>
            <button
              type="button"
              className={btnSecondary}
              disabled={busy}
              onClick={() => onOpenChange(false)}
            >
              {cancelLabel}
            </button>
          </div>
        </div>
      </div>
    </dialog>
  );
}
