"use client";

import { useEffect, useId, useRef } from "react";

type Props = {
  src: string;
  label: string;
  onClose: () => void;
};

export function AvatarLightbox({ src, label, onClose }: Props) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = dialogRef.current;
    if (!d) return;
    if (!d.open) d.showModal();
    return () => {
      if (d.open) d.close();
    };
  }, []);

  return (
    <dialog
      ref={dialogRef}
      className="bg-transparent fixed inset-0 z-[125] m-0 size-full max-h-none max-w-none overflow-hidden p-0 [&::backdrop]:bg-black/80 [&::backdrop]:backdrop-blur-sm"
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={onClose}
    >
      <div className="pointer-events-none flex size-full items-center justify-center p-[max(1rem,env(safe-area-inset-top))]">
        <div className="pointer-events-auto flex flex-col items-center gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt={label}
            draggable={false}
            onClick={(e) => e.stopPropagation()}
            className="border-border max-h-[min(70dvh,30rem)] max-w-[min(80vw,30rem)] rounded-full border-4 object-cover shadow-2xl"
          />
          <p
            id={titleId}
            onClick={(e) => e.stopPropagation()}
            className="text-foreground text-base font-semibold drop-shadow-md"
          >
            {label}
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="text-foreground hover:bg-muted/80 focus-visible:ring-ring fixed right-[max(0.75rem,env(safe-area-inset-right))] top-[max(0.75rem,env(safe-area-inset-top))] inline-flex size-10 items-center justify-center rounded-full bg-black/40 backdrop-blur transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-5" aria-hidden>
          <path d="M18 6 6 18M6 6l12 12" />
        </svg>
      </button>
    </dialog>
  );
}
