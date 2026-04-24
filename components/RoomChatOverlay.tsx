"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

const MIN_HEIGHT = 240;
const STORAGE_KEY = "vibin.chatOverlayHeight";

type Props = {
  open: boolean;
  /** Ref to the video frame — overlay's top will not go above its bottom edge. */
  anchorRef: React.RefObject<HTMLElement | null>;
  /** Called when the user clicks or taps outside the overlay. */
  onDismiss?: () => void;
  children: ReactNode;
};

/**
 * Floating, resizable chat overlay. Pinned to the bottom-right on desktop and
 * full-width bottom on narrow viewports. Default height sizes so the top edge
 * sits just below the video section.
 */
export function RoomChatOverlay({ open, anchorRef, onDismiss, children }: Props) {
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const [height, setHeight] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);

  const computeDefaultHeight = useCallback(() => {
    if (typeof window === "undefined") return 420;
    const vh = window.innerHeight;
    const el = anchorRef.current;
    if (!el) return Math.max(MIN_HEIGHT, Math.round(vh * 0.5));
    const rect = el.getBoundingClientRect();
    const available = vh - rect.bottom - 16;
    return Math.max(MIN_HEIGHT, available);
  }, [anchorRef]);

  // On first open, pick a height that keeps the overlay below the video.
  useEffect(() => {
    if (!open) return;
    if (height != null) return;
    const frame = window.requestAnimationFrame(() => {
      try {
        const stored = window.localStorage.getItem(STORAGE_KEY);
        const parsed = stored ? Number.parseInt(stored, 10) : NaN;
        if (Number.isFinite(parsed) && parsed >= MIN_HEIGHT) {
          setHeight(parsed);
          return;
        }
      } catch {
        /* ignore */
      }
      setHeight(computeDefaultHeight());
    });
    return () => window.cancelAnimationFrame(frame);
  }, [open, height, computeDefaultHeight]);

  // Clamp height when the viewport resizes.
  useEffect(() => {
    if (!open) return;
    const onResize = () => {
      setHeight((prev) => {
        if (prev == null) return prev;
        const max = window.innerHeight - 16;
        return Math.min(max, Math.max(MIN_HEIGHT, prev));
      });
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [open]);

  // Dismiss on clicks or taps outside the overlay.
  useEffect(() => {
    if (!open || !onDismiss) return;
    const onPointerDown = (e: PointerEvent) => {
      const root = overlayRef.current;
      if (!root) return;
      const target = e.target as Node | null;
      if (target && root.contains(target)) return;
      // Ignore clicks on the chat-head trigger so it can toggle cleanly.
      if (target instanceof Element && target.closest(".vibin-chat-head")) return;
      onDismiss();
    };
    window.addEventListener("pointerdown", onPointerDown, true);
    return () => window.removeEventListener("pointerdown", onPointerDown, true);
  }, [open, onDismiss]);

  const startDrag = useCallback(
    (startY: number, startHeight: number) => {
      setDragging(true);
      const prevUserSelect = document.body.style.userSelect;
      document.body.style.userSelect = "none";
      const onMove = (clientY: number) => {
        const delta = startY - clientY; // up = grow
        const vh = window.innerHeight;
        const next = Math.min(vh - 16, Math.max(MIN_HEIGHT, startHeight + delta));
        setHeight(next);
      };
      const onMouseMove = (e: MouseEvent) => onMove(e.clientY);
      const onTouchMove = (e: TouchEvent) => {
        if (e.touches.length === 0) return;
        onMove(e.touches[0].clientY);
      };
      const stop = () => {
        setDragging(false);
        document.body.style.userSelect = prevUserSelect;
        window.removeEventListener("mousemove", onMouseMove);
        window.removeEventListener("mouseup", stop);
        window.removeEventListener("touchmove", onTouchMove);
        window.removeEventListener("touchend", stop);
        setHeight((h) => {
          if (h != null) {
            try {
              window.localStorage.setItem(STORAGE_KEY, String(Math.round(h)));
            } catch {
              /* ignore */
            }
          }
          return h;
        });
      };
      window.addEventListener("mousemove", onMouseMove);
      window.addEventListener("mouseup", stop);
      window.addEventListener("touchmove", onTouchMove, { passive: true });
      window.addEventListener("touchend", stop);
    },
    [],
  );

  if (!open || height == null) return null;

  const h = height;

  return (
    <div
      ref={overlayRef}
      className="fixed z-[65] flex flex-col overflow-hidden rounded-2xl border border-border/70 bg-background/95 shadow-[0_-18px_40px_-18px_rgba(0,0,0,0.55)] backdrop-blur-md right-3 left-3 bottom-[calc(var(--vibin-keyboard-inset,0px)+5.5rem)] min-[708px]:left-auto min-[708px]:right-4 min-[708px]:bottom-[var(--vibin-keyboard-inset,0px)] min-[708px]:w-[min(22rem,36vw)] xl:w-96"
      style={{ height: h }}
      role="dialog"
      aria-label="Chat"
    >
      <div
        role="separator"
        aria-orientation="horizontal"
        aria-label="Resize chat"
        onMouseDown={(e) => {
          e.preventDefault();
          startDrag(e.clientY, h);
        }}
        onTouchStart={(e) => {
          if (e.touches.length === 0) return;
          startDrag(e.touches[0].clientY, h);
        }}
        className={`group flex h-4 w-full shrink-0 cursor-row-resize items-center justify-center ${dragging ? "bg-muted/40" : "hover:bg-muted/30"}`}
      >
        <span
          className="block h-1 w-10 rounded-full bg-muted-foreground/40 group-hover:bg-muted-foreground/70"
          aria-hidden
        />
      </div>
      <div className="flex min-h-0 flex-1 flex-col">{children}</div>
    </div>
  );
}
