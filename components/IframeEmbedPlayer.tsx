"use client";

import { forwardRef, useImperativeHandle, useRef } from "react";
import type { YouTubeSyncPlayerHandle } from "@/components/YouTubeHostPlayer";

type Props = {
  embedUrl: string | null;
  className?: string;
};

/**
 * Generic iframe player. Sync (anchor seek, programmatic pause/play, end detection)
 * is not available — third-party iframes don't expose a control API. The host can
 * still skip via the queue controls; per-iframe state stays inside the iframe.
 */
export const IframeEmbedPlayer = forwardRef<YouTubeSyncPlayerHandle, Props>(
  function IframeEmbedPlayer({ embedUrl, className }, ref) {
    const surfaceRef = useRef<HTMLDivElement>(null);

    useImperativeHandle(ref, () => ({
      getCurrentTime: () => null,
      getDuration: () => null,
      requestFullscreen: () => {
        const el = surfaceRef.current;
        if (!el) return;
        try {
          void el.requestFullscreen?.();
        } catch {
          /* ignore */
        }
      },
    }));

    return (
      <div
        ref={surfaceRef}
        className={`ring-primary/25 relative w-full max-h-[min(42vh,22rem)] overflow-hidden rounded-xl bg-black shadow-md ring-2 min-[708px]:max-h-[min(72vh,48rem)] ${className ?? ""}`}
        style={{ aspectRatio: "16 / 9" }}
      >
        {embedUrl ? (
          <iframe
            src={embedUrl}
            className="h-full w-full border-0 bg-black"
            allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
            allowFullScreen
            referrerPolicy="no-referrer-when-downgrade"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs text-white/60">
            Nothing playing
          </div>
        )}
      </div>
    );
  }
);

IframeEmbedPlayer.displayName = "IframeEmbedPlayer";
